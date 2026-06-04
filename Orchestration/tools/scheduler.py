"""
scheduler.py

Registers all time-based jobs with APScheduler and starts the scheduler.
Called by run_all.py — do not run directly unless testing job registration.

Job schedule:
    Daily 8:00am   → briefing + cash flow alert
    Daily 6:00pm   → review request check
    Monday 8:00am  → weekly revenue report
    1st of month   → reactivation, payroll, P&L
"""

import os
import csv
import logging
import time
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger("scheduler")

ORCH_LOG = ".tmp/orchestration_log.csv"
ORCH_LOG_COLUMNS = ["timestamp", "job_name", "status", "actions_taken", "duration_seconds", "error"]

TIMEZONE = os.getenv("SCHEDULER_TIMEZONE", "America/Chicago")
BRIEFING_TIME = os.getenv("BRIEFING_TIME", "08:00")
REVIEW_TIME = os.getenv("REVIEW_REQUEST_TIME", "18:00")


def log_job_run(job_name: str, status: str, actions: int = 0,
                duration: float = 0.0, error: str = ""):
    os.makedirs(os.path.dirname(ORCH_LOG) or ".", exist_ok=True)
    file_exists = os.path.exists(ORCH_LOG)
    with open(ORCH_LOG, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=ORCH_LOG_COLUMNS)
        if not file_exists:
            writer.writeheader()
        writer.writerow({
            "timestamp": datetime.now().isoformat(),
            "job_name": job_name,
            "status": status,
            "actions_taken": actions,
            "duration_seconds": round(duration, 2),
            "error": error,
        })


def run_job(job_name: str, job_fn, dry_run: bool = False):
    """Wrapper that times a job, catches errors, and logs the result."""
    start = time.time()
    log.info(f"[scheduler] Running: {job_name}")
    try:
        result = job_fn(dry_run=dry_run)
        duration = time.time() - start
        actions = result if isinstance(result, int) else 0
        log_job_run(job_name, "success", actions, duration)
        log.info(f"[scheduler] {job_name} completed in {duration:.1f}s")
    except Exception as e:
        duration = time.time() - start
        log_job_run(job_name, "failed", 0, duration, str(e))
        log.error(f"[scheduler] {job_name} FAILED: {e}")


# ─── Job Wrappers ─────────────────────────────────────────────────────────────

def job_briefing(dry_run=False):
    if os.getenv("DISABLE_BRIEFING", "").lower() == "true":
        return 0
    from Orchestration.tools.briefing import send_briefing
    send_briefing(dry_run=dry_run)
    return 1


def job_cash_flow_alert(dry_run=False):
    from Orchestration.jobs.cash_flow_alert import run as run_alert
    return run_alert(dry_run=dry_run)


def job_review_requests(dry_run=False):
    if os.getenv("DISABLE_REVIEW_REQUESTS", "").lower() == "true":
        return 0
    from Orchestration.jobs.daily_review_requests import run as run_reviews
    return run_reviews(dry_run=dry_run)


def job_weekly_revenue(dry_run=False):
    from Orchestration.jobs.weekly_revenue_report import run as run_weekly
    return run_weekly(dry_run=dry_run)


def job_monthly_reactivation(dry_run=False):
    if os.getenv("DISABLE_REACTIVATION", "").lower() == "true":
        return 0
    from Orchestration.jobs.monthly_reactivation import run as run_react
    return run_react(dry_run=dry_run)


def job_monthly_payroll(dry_run=False):
    from Orchestration.jobs.monthly_payroll import run as run_payroll
    return run_payroll(dry_run=dry_run)


# ─── Scheduler Setup ──────────────────────────────────────────────────────────

def build_scheduler(dry_run: bool = False):
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.cron import CronTrigger
        import pytz
    except ImportError:
        raise RuntimeError(
            "APScheduler not installed. Run: pip install -r Orchestration/requirements.txt"
        )

    tz = pytz.timezone(TIMEZONE)
    scheduler = BackgroundScheduler(timezone=tz)

    briefing_h, briefing_m = BRIEFING_TIME.split(":")
    review_h, review_m = REVIEW_TIME.split(":")

    jobs = [
        # Daily 8am — briefing
        {
            "name": "daily_briefing",
            "fn": job_briefing,
            "trigger": CronTrigger(hour=int(briefing_h), minute=int(briefing_m), timezone=tz),
        },
        # Daily 8am — cash flow alert (runs after briefing)
        {
            "name": "cash_flow_alert",
            "fn": job_cash_flow_alert,
            "trigger": CronTrigger(hour=int(briefing_h), minute=int(briefing_m) + 2, timezone=tz),
        },
        # Daily 6pm — review requests
        {
            "name": "daily_review_requests",
            "fn": job_review_requests,
            "trigger": CronTrigger(hour=int(review_h), minute=int(review_m), timezone=tz),
        },
        # Monday 8am — weekly revenue report
        {
            "name": "weekly_revenue_report",
            "fn": job_weekly_revenue,
            "trigger": CronTrigger(day_of_week="mon", hour=int(briefing_h), minute=int(briefing_m) + 5, timezone=tz),
        },
        # 1st of month 9am — reactivation campaign
        {
            "name": "monthly_reactivation",
            "fn": job_monthly_reactivation,
            "trigger": CronTrigger(day=1, hour=9, minute=0, timezone=tz),
        },
        # 1st of month 9:30am — payroll report
        {
            "name": "monthly_payroll",
            "fn": job_monthly_payroll,
            "trigger": CronTrigger(day=1, hour=9, minute=30, timezone=tz),
        },
    ]

    for job in jobs:
        scheduler.add_job(
            func=run_job,
            trigger=job["trigger"],
            args=[job["name"], job["fn"], dry_run],
            id=job["name"],
            replace_existing=True,
            misfire_grace_time=3600,  # 1 hour tolerance
        )
        log.info(f"[scheduler] Registered: {job['name']}")

    return scheduler, jobs
