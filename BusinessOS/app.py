"""
BusinessOS — Main Flask Application

Entry point for the white-label small business management platform.

Usage:
    python BusinessOS/app.py
    python BusinessOS/app.py --port 8080
    python BusinessOS/app.py --host 0.0.0.0     # LAN access
"""

import os, sys, argparse
from datetime import date, timedelta
from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify, send_file

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from dotenv import load_dotenv
load_dotenv(os.path.join(ROOT, ".env"))

from BusinessOS.core.db import get_db, get_company, get_active_modules, fmt_currency
from BusinessOS.core.auth import login_required, verify_password, hash_password, get_current_user
from BusinessOS.core.backup import create_backup, list_backups, restore_backup, delete_backup, BACKUP_DIR
from BusinessOS.modules.payroll_bp    import payroll_bp
from BusinessOS.modules.timeclock_bp  import timeclock_bp
from BusinessOS.modules.financial_bp  import financial_bp
from BusinessOS.modules.marketing_bp  import marketing_bp
from BusinessOS.modules.calendar_bp   import calendar_bp

app = Flask(__name__, template_folder="templates")
app.secret_key = os.getenv("FLASK_SECRET_KEY", os.urandom(32).hex())

app.register_blueprint(payroll_bp,    url_prefix="/payroll")
app.register_blueprint(timeclock_bp,  url_prefix="/timeclock")
app.register_blueprint(financial_bp,  url_prefix="/financial")
app.register_blueprint(marketing_bp,  url_prefix="/marketing")
app.register_blueprint(calendar_bp,   url_prefix="/calendar")


# ── Context processor (available in ALL templates) ───────────────────────────
@app.context_processor
def inject_globals():
    company_id = session.get("company_id") or 1
    conn = get_db(); cur = conn.cursor()
    company = get_company(cur)
    modules = get_active_modules(cur, company_id) if company else set()
    if not modules:
        modules = {"payroll", "timeclock", "financial", "marketing"}
    cur.close(); conn.close()
    return dict(
        company=company,
        active_modules=modules,
        today=date.today(),
        fmt=fmt_currency,
    )


# ── Auth ─────────────────────────────────────────────────────────────────────
@app.route("/login", methods=["GET","POST"])
def login():
    if session.get("user_id"):
        return redirect(url_for("dashboard"))
    error = None
    if request.method == "POST":
        username = request.form.get("username","").strip()
        password = request.form.get("password","")
        conn = get_db(); cur = conn.cursor()
        cur.execute("SELECT id, company_id, password_hash, role FROM bos_users WHERE username=%s", (username,))
        user = cur.fetchone()
        cur.close(); conn.close()
        if user and verify_password(password, user["password_hash"]):
            session["user_id"]    = user["id"]
            session["company_id"] = user["company_id"]
            session["role"]       = user["role"]
            session["username"]   = username
            return redirect(url_for("dashboard"))
        error = "Invalid username or password."
    return render_template("login.html", error=error)


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


# ── Dashboard ─────────────────────────────────────────────────────────────────
@app.route("/")
@login_required
def dashboard():
    conn = get_db(); cur = conn.cursor()
    company    = get_company(cur)
    company_id = session.get("company_id", 1)
    modules    = get_active_modules(cur, company_id)

    today       = date.today()
    week_start  = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)

    def q(sql, *args):
        try:
            cur.execute(sql, args)
            r = cur.fetchone()
            return float(r[0]) if r and r[0] is not None else 0.0
        except Exception:
            return 0.0

    # Revenue KPIs
    rev_week  = q("SELECT COALESCE(SUM(total),0) FROM pos_transactions WHERE created_at::date >= %s AND status='completed' AND total>0", week_start)
    rev_month = q("SELECT COALESCE(SUM(total),0) FROM pos_transactions WHERE created_at::date >= %s AND status='completed' AND total>0", month_start)

    # Payroll KPIs
    payroll_week_gross = q("""
        SELECT COALESCE(SUM(pe.gross_pay),0) FROM payroll_entries pe
        JOIN payroll_runs pr ON pr.id=pe.run_id
        WHERE pr.pay_period_start >= %s
    """, week_start)

    # Hours this week
    hours_week = q("""
        SELECT COALESCE(SUM(hours_worked),0) FROM time_entries
        WHERE clock_in::date >= %s AND hours_worked IS NOT NULL
    """, week_start)

    # Active employees
    emp_count = int(q("SELECT COUNT(*) FROM employees WHERE active=TRUE"))

    # Recent payroll runs
    try:
        cur.execute("""
            SELECT id, pay_period_start, pay_period_end, status, total_gross, total_net
            FROM payroll_runs ORDER BY pay_period_start DESC LIMIT 5
        """)
        recent_runs = [dict(r) for r in cur.fetchall()]
    except Exception:
        recent_runs = []

    # Who's clocked in right now
    try:
        cur.execute("""
            SELECT COALESCE(NULLIF(t.first_name || ' ' || t.last_name, ' '), t.name) AS name, te.clock_in
            FROM time_entries te JOIN technicians t ON t.id=te.technician_id
            WHERE te.clock_out IS NULL ORDER BY te.clock_in
        """)
        clocked_in = [dict(r) for r in cur.fetchall()]
    except Exception:
        clocked_in = []

    # Upcoming tax deadlines (next 60 days)
    year = today.year
    all_deadlines = [
        {"name": f"Form 941 Q1 {year}", "due": date(year,4,30)},
        {"name": f"Form 941 Q2 {year}", "due": date(year,7,31)},
        {"name": f"Form 941 Q3 {year}", "due": date(year,10,31)},
        {"name": f"Form 941 Q4 {year}", "due": date(year+1,1,31)},
        {"name": f"Form 940 (FUTA) {year}", "due": date(year+1,1,31)},
        {"name": f"W-2 / 1099-NEC {year}", "due": date(year+1,1,31)},
    ]
    upcoming = [d for d in all_deadlines if today <= d["due"] <= today + timedelta(days=60)]
    for d in upcoming:
        d["days_away"] = (d["due"] - today).days

    cur.close(); conn.close()
    return render_template("dashboard.html",
        modules=modules, page="dashboard",
        rev_week=rev_week, rev_month=rev_month,
        payroll_week_gross=payroll_week_gross,
        hours_week=hours_week, emp_count=emp_count,
        recent_runs=recent_runs, clocked_in=clocked_in,
        upcoming_deadlines=upcoming,
    )


# ── Settings ──────────────────────────────────────────────────────────────────
@app.route("/settings", methods=["GET","POST"])
@login_required
def settings():
    conn = get_db(); cur = conn.cursor()
    company    = get_company(cur)
    company_id = session.get("company_id", 1)
    modules    = get_active_modules(cur, company_id)

    if request.method == "POST":
        action = request.form.get("action")

        if action == "update_company":
            cur.execute("""
                UPDATE companies SET name=%s, state=%s, ein=%s, address=%s,
                    phone=%s, email=%s, timezone=%s WHERE id=%s
            """, (
                request.form.get("name"), request.form.get("state"),
                request.form.get("ein"),  request.form.get("address"),
                request.form.get("phone"),request.form.get("email"),
                request.form.get("timezone"), company_id,
            ))
            conn.commit()
            flash("Company info saved.", "success")

        elif action == "update_modules":
            cur.execute("SELECT module FROM module_licenses WHERE company_id=%s", (company_id,))
            all_mods = [r["module"] for r in cur.fetchall()]
            for mod in all_mods:
                enabled = request.form.get(f"mod_{mod}") == "on"
                cur.execute("UPDATE module_licenses SET enabled=%s WHERE company_id=%s AND module=%s",
                            (enabled, company_id, mod))
            conn.commit()
            flash("Module settings saved.", "success")

        elif action == "change_password":
            current_pw = request.form.get("current_password","")
            new_pw     = request.form.get("new_password","")
            confirm_pw = request.form.get("confirm_password","")
            cur.execute("SELECT password_hash FROM bos_users WHERE id=%s", (session["user_id"],))
            user = cur.fetchone()
            if not verify_password(current_pw, user["password_hash"]):
                flash("Current password is incorrect.", "danger")
            elif new_pw != confirm_pw:
                flash("New passwords do not match.", "danger")
            elif len(new_pw) < 6:
                flash("Password must be at least 6 characters.", "danger")
            else:
                cur.execute("UPDATE bos_users SET password_hash=%s WHERE id=%s",
                            (hash_password(new_pw), session["user_id"]))
                conn.commit()
                flash("Password updated.", "success")

        cur.close(); conn.close()
        return redirect(url_for("settings"))

    # GET
    cur.execute("""
        SELECT module, label, price_note, enabled
        FROM module_licenses WHERE company_id=%s ORDER BY id
    """, (company_id,))
    all_modules = [dict(r) for r in cur.fetchall()]

    backups = list_backups()
    env_vars = {
        "EMPLOYER_STATE": os.getenv("EMPLOYER_STATE",""),
        "EMPLOYER_EIN":   os.getenv("EMPLOYER_EIN",""),
        "OWNER_EMAIL":    os.getenv("OWNER_EMAIL",""),
        "REVIEW_LINK":    os.getenv("REVIEW_LINK",""),
        "ADMIN_PIN":      os.getenv("ADMIN_PIN","1234"),
    }

    cur.close(); conn.close()
    return render_template("settings.html",
        modules=modules, all_modules=all_modules,
        backups=backups, env_vars=env_vars, page="settings",
    )


# ── Backup API ────────────────────────────────────────────────────────────────
@app.route("/backup/create", methods=["POST"])
@login_required
def backup_create():
    result = create_backup("manual")
    if result["success"]:
        mb = round(result["size"] / 1_048_576, 2)
        flash(f"Backup created: {result['filename']} ({mb} MB)", "success")
    else:
        flash(f"Backup failed: {result['error']}", "danger")
    return redirect(url_for("settings") + "#backup")


@app.route("/backup/download/<filename>")
@login_required
def backup_download(filename):
    import os
    fpath = os.path.join(BACKUP_DIR, filename)
    if os.path.exists(fpath) and filename.endswith(".sql.gz"):
        return send_file(fpath, as_attachment=True, download_name=filename)
    flash("Backup file not found.", "danger")
    return redirect(url_for("settings") + "#backup")


@app.route("/backup/restore/<filename>", methods=["POST"])
@login_required
def backup_restore(filename):
    result = restore_backup(filename)
    if result["success"]:
        flash(f"Database restored from {filename}.", "success")
    else:
        flash(f"Restore failed: {result['error']}", "danger")
    return redirect(url_for("settings") + "#backup")


@app.route("/backup/delete/<filename>", methods=["POST"])
@login_required
def backup_delete(filename):
    if delete_backup(filename):
        flash(f"Backup {filename} deleted.", "success")
    else:
        flash("Backup not found.", "danger")
    return redirect(url_for("settings") + "#backup")


# ── Entry point ───────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="BusinessOS web application.")
    parser.add_argument("--host",  default="127.0.0.1", help="Host (use 0.0.0.0 for LAN)")
    parser.add_argument("--port",  type=int, default=8000)
    parser.add_argument("--debug", action="store_true")
    args = parser.parse_args()

    company_name = os.getenv("BUSINESS_NAME", "BusinessOS")
    print(f"\n  {company_name} — BusinessOS")
    print(f"  Running at http://{args.host}:{args.port}")
    print(f"  Login at: http://127.0.0.1:{args.port}/login\n")
    app.run(host=args.host, port=args.port, debug=args.debug)


if __name__ == "__main__":
    main()
