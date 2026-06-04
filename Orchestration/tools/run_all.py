"""
run_all.py

The single entry point for the orchestration system.
Starts the APScheduler (time-based jobs) and the event listener (trigger-based).

Usage:
    python Orchestration/tools/run_all.py               # start the full system
    python Orchestration/tools/run_all.py --dry-run     # run without sending anything
    python Orchestration/tools/run_all.py --status      # print job schedule + recent log
    python Orchestration/tools/run_all.py --run-now briefing    # run a specific job immediately
    python Orchestration/tools/run_all.py --run-now all         # run all jobs immediately (test)
"""

import os
import sys
import csv
import time
import signal
import logging
import argparse
from datetime import datetime, date, timedelta
from dotenv import load_dotenv

# Add workspace root to path so all imports resolve correctly
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

load_dotenv(os.path.join(ROOT, ".env"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("run_all")

ORCH_LOG = os.path.join(ROOT, ".tmp", "orchestration_log.csv")


def print_status():
    """Print upcoming job schedule and recent log entries."""
    print("\n" + "=" * 60)
    print("  ORCHESTRATION SYSTEM STATUS")
    print("=" * 60)
    print(f"  Timezone:     {os.getenv('SCHEDULER_TIMEZONE', 'America/Chicago')}")
    print(f"  Briefing:     Daily at {os.getenv('BRIEFING_TIME', '08:00')}")
    print(f"  Reviews:      Daily at {os.getenv('REVIEW_REQUEST_TIME', '18:00')}")
    print(f"  Weekly report: Mondays at {os.getenv('BRIEFING_TIME', '08:00')}")
    print(f"  Monthly jobs: 1st of month")

    disabled = []
    for flag in ["DISABLE_BRIEFING", "DISABLE_REVIEW_REQUESTS", "DISABLE_REACTIVATION"]:
        if os.getenv(flag, "").lower() == "true":
            disabled.append(flag.replace("DISABLE_", "").lower())
    if disabled:
        print(f"\n  Disabled jobs: {', '.join(disabled)}")

    print(f"\n  RECENT JOB RUNS")
    if not os.path.exists(ORCH_LOG):
        print("  No runs logged yet.")
    else:
        cutoff = (date.today() - timedelta(days=7)).isoformat()
        rows = []
        with open(ORCH_LOG, "r", newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get("timestamp", "")[:10] >= cutoff:
                    rows.append(row)
        if not rows:
            print("  No runs in the past 7 days.")
        else:
            rows = rows[-15:]
            for row in rows:
                status_icon = "✅" if row["status"] == "success" else "❌"
                print(f"  {status_icon} {row['timestamp'][:16]}  {row['job_name']:<28}  {row['status']}")

    print()


def run_job_now(job_name: str, dry_run: bool = False):
    """Run a specific job immediately."""
    from Orchestration.tools.scheduler import (
        job_briefing, job_cash_flow_alert, job_review_requests,
        job_weekly_revenue, job_monthly_reactivation, job_monthly_payroll,
        run_job
    )
    from Orchestration.tools.event_listener import run_poll

    job_map = {
        "briefing": job_briefing,
        "cash_flow_alert": job_cash_flow_alert,
        "review_requests": job_review_requests,
        "weekly_revenue": job_weekly_revenue,
        "monthly_reactivation": job_monthly_reactivation,
        "monthly_payroll": job_monthly_payroll,
    }

    if job_name == "all":
        for name, fn in job_map.items():
            run_job(name, fn, dry_run=dry_run)
        run_poll(dry_run=dry_run)
        return

    if job_name == "event_listener":
        run_poll(dry_run=dry_run)
        return

    if job_name not in job_map:
        print(f"Unknown job: {job_name}")
        print(f"Available: {', '.join(list(job_map.keys()) + ['event_listener', 'all'])}")
        return

    run_job(job_name, job_map[job_name], dry_run=dry_run)


def validate_env():
    """Warn about missing critical .env variables."""
    warnings = []
    required = {
        "OWNER_EMAIL": "Where reports and alerts are sent",
        "SENDGRID_API_KEY": "Required to send any emails",
        "SCHEDULER_TIMEZONE": "Ensures jobs fire at the right time",
    }
    optional = {
        "TWILIO_ACCOUNT_SID": "Required for SMS review requests",
        "REVIEW_LINK": "Required for review request messages",
        "CASH_ALERT_THRESHOLD": "Set to 3x monthly fixed costs",
    }
    for key, desc in required.items():
        if not os.getenv(key):
            warnings.append(f"  ❌ MISSING {key} — {desc}")
    for key, desc in optional.items():
        if not os.getenv(key):
            warnings.append(f"  ⚠  NOT SET {key} — {desc}")
    return warnings


def main():
    parser = argparse.ArgumentParser(description="Business Orchestration System")
    parser.add_argument("--dry-run", action="store_true",
                        help="Run all logic but send nothing.")
    parser.add_argument("--status", action="store_true",
                        help="Print job schedule and recent log.")
    parser.add_argument("--run-now", type=str, metavar="JOB",
                        help="Run a specific job immediately (briefing, review_requests, etc.)")
    args = parser.parse_args()

    if args.status:
        print_status()
        return

    if args.run_now:
        run_job_now(args.run_now, dry_run=args.dry_run)
        return

    # Startup validation
    warnings = validate_env()
    print("\n" + "=" * 60)
    print("  BUSINESS ORCHESTRATION SYSTEM")
    print(f"  Starting — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    if warnings:
        print("\n  Configuration warnings:")
        for w in warnings:
            print(w)
        if any("❌" in w for w in warnings):
            print("\n  ❌ Missing required config. Fix .env before starting.")
            print("  See: Orchestration/README.md for all required variables.\n")
            sys.exit(1)
        print()

    if args.dry_run:
        print("  ⚠  DRY RUN MODE — no emails or SMS will be sent\n")

    # Start scheduler
    from Orchestration.tools.scheduler import build_scheduler
    scheduler, jobs = build_scheduler(dry_run=args.dry_run)
    scheduler.start()
    print(f"\n  ✅ Scheduler started — {len(jobs)} jobs registered")
    for job in jobs:
        job_obj = scheduler.get_job(job["name"])
        if job_obj and job_obj.next_run_time:
            print(f"     {job['name']:<30} next: {job_obj.next_run_time.strftime('%Y-%m-%d %H:%M %Z')}")

    # Start event listener
    from Orchestration.tools.event_listener import start_background
    listener_thread = start_background(dry_run=args.dry_run)
    print(f"\n  ✅ Event listener started (polling every {os.getenv('EVENT_POLL_INTERVAL', 300)}s)")

    print(f"\n  System live. Press Ctrl+C to stop.\n")

    # Graceful shutdown
    def shutdown(signum, frame):
        print("\n  Shutting down gracefully...")
        scheduler.shutdown(wait=False)
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # Keep main thread alive
    while True:
        time.sleep(60)


if __name__ == "__main__":
    main()
