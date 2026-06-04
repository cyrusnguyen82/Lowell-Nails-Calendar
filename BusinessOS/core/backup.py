"""
backup.py — Database backup and restore for BusinessOS

Creates compressed pg_dump backups and logs them to the backup_log table.
Backups are stored in .backups/ relative to the project root.

Usage (CLI):
    python BusinessOS/core/backup.py --create
    python BusinessOS/core/backup.py --list
    python BusinessOS/core/backup.py --restore backup_20260517_083000.sql.gz
    python BusinessOS/core/backup.py --delete backup_20260517_083000.sql.gz
"""

import os, sys, gzip, shutil, subprocess, argparse
from datetime import datetime
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
load_dotenv(os.path.join(ROOT, ".env"))

BACKUP_DIR = os.path.join(ROOT, ".backups")


def get_db():
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL not set in .env")
    return psycopg2.connect(url, cursor_factory=psycopg2.extras.RealDictCursor)


def _log_backup(filename: str, size_bytes: int, backup_type: str = "manual", status: str = "success", notes: str = ""):
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute(
            "INSERT INTO backup_log (filename, size_bytes, type, status, notes) VALUES (%s,%s,%s,%s,%s)",
            (filename, size_bytes, backup_type, status, notes)
        )
        conn.commit(); cur.close(); conn.close()
    except Exception:
        pass  # Don't fail the backup because logging failed


def create_backup(backup_type: str = "manual") -> dict:
    """
    Run pg_dump and save a gzip-compressed SQL backup.
    Returns {"success": bool, "filename": str, "size": int, "error": str}
    """
    os.makedirs(BACKUP_DIR, exist_ok=True)
    db_url  = os.getenv("DATABASE_URL")
    ts      = datetime.now().strftime("%Y%m%d_%H%M%S")
    fname   = f"backup_{ts}.sql.gz"
    fpath   = os.path.join(BACKUP_DIR, fname)

    try:
        result = subprocess.run(
            ["pg_dump", "--no-owner", "--no-acl", "--clean", db_url],
            capture_output=True, timeout=120
        )
        if result.returncode != 0:
            err = result.stderr.decode()
            _log_backup(fname, 0, backup_type, "failed", err[:500])
            return {"success": False, "filename": fname, "size": 0, "error": err}

        with gzip.open(fpath, "wb", compresslevel=6) as f:
            f.write(result.stdout)

        size = os.path.getsize(fpath)
        _log_backup(fname, size, backup_type, "success")
        return {"success": True, "filename": fname, "size": size, "error": None}

    except FileNotFoundError:
        err = "pg_dump not found. Install PostgreSQL client tools (pg_dump must be in PATH)."
        _log_backup(fname, 0, backup_type, "failed", err)
        return {"success": False, "filename": None, "size": 0, "error": err}
    except Exception as e:
        err = str(e)
        _log_backup(fname, 0, backup_type, "failed", err)
        return {"success": False, "filename": None, "size": 0, "error": err}


def restore_backup(filename: str) -> dict:
    """
    Restore from a .sql.gz backup using psql.
    WARNING: This replaces all current data.
    Returns {"success": bool, "error": str}
    """
    fpath = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(fpath):
        return {"success": False, "error": f"Backup file not found: {filename}"}

    db_url = os.getenv("DATABASE_URL")
    try:
        with gzip.open(fpath, "rb") as f:
            sql_data = f.read()

        result = subprocess.run(
            ["psql", db_url],
            input=sql_data, capture_output=True, timeout=300
        )
        if result.returncode != 0:
            err = result.stderr.decode()[:500]
            return {"success": False, "error": err}

        _log_backup(filename, 0, "restore", "success", f"Restored from {filename}")
        return {"success": True, "error": None}

    except FileNotFoundError:
        return {"success": False, "error": "psql not found. Install PostgreSQL client tools."}
    except Exception as e:
        return {"success": False, "error": str(e)}


def list_backups() -> list:
    """List all backup files with metadata from backup_log and filesystem."""
    os.makedirs(BACKUP_DIR, exist_ok=True)

    # Get log entries
    log_map = {}
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute(
            "SELECT filename, size_bytes, type, status, created_at FROM backup_log ORDER BY created_at DESC"
        )
        for r in cur.fetchall():
            log_map[r["filename"]] = r
        cur.close(); conn.close()
    except Exception:
        pass

    # Scan filesystem
    backups = []
    for fname in sorted(os.listdir(BACKUP_DIR), reverse=True):
        if not fname.endswith(".sql.gz"):
            continue
        fpath = os.path.join(BACKUP_DIR, fname)
        size  = os.path.getsize(fpath)
        mtime = datetime.fromtimestamp(os.path.getmtime(fpath))
        log   = log_map.get(fname, {})
        backups.append({
            "filename":  fname,
            "size_bytes": size,
            "size_mb":   round(size / 1_048_576, 2),
            "created_at": mtime,
            "type":      log.get("type", "manual"),
            "status":    log.get("status", "unknown"),
        })
    return backups


def delete_backup(filename: str) -> bool:
    fpath = os.path.join(BACKUP_DIR, filename)
    if os.path.exists(fpath):
        os.remove(fpath)
        return True
    return False


def schedule_auto_backup():
    """Trigger a backup from the scheduler (called by Orchestration/tools/scheduler.py)."""
    result = create_backup(backup_type="scheduled")
    return result["success"]


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="BusinessOS database backup utility.")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--create",  action="store_true", help="Create a new backup")
    mode.add_argument("--list",    action="store_true", help="List all backups")
    mode.add_argument("--restore", type=str, metavar="FILE", help="Restore from backup file")
    mode.add_argument("--delete",  type=str, metavar="FILE", help="Delete a backup file")
    args = parser.parse_args()

    if args.create:
        print("Creating backup...")
        r = create_backup()
        if r["success"]:
            mb = round(r["size"] / 1_048_576, 2)
            print(f"Backup created: {r['filename']} ({mb} MB)")
        else:
            print(f"Backup failed: {r['error']}")

    elif args.list:
        backups = list_backups()
        if not backups:
            print("No backups found in .backups/")
        else:
            print(f"\n  {'Filename':<40} {'Size':>8} {'Type':<12} {'Date'}")
            print("  " + "─"*70)
            for b in backups:
                print(f"  {b['filename']:<40} {b['size_mb']:>6} MB  {b['type']:<12} {b['created_at'].strftime('%Y-%m-%d %H:%M')}")
            print()

    elif args.restore:
        confirm = input(f"Restore from {args.restore}? This will overwrite current data. [yes/no]: ")
        if confirm.strip().lower() == "yes":
            print("Restoring...")
            r = restore_backup(args.restore)
            print("Restore successful." if r["success"] else f"Restore failed: {r['error']}")
        else:
            print("Cancelled.")

    elif args.delete:
        if delete_backup(args.delete):
            print(f"Deleted {args.delete}")
        else:
            print(f"File not found: {args.delete}")


if __name__ == "__main__":
    main()
