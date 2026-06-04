"""
weekly_revenue_report.py

Compiles last 7 days of revenue by day and technician,
compares to prior week, and emails the summary to the owner.

Called automatically by the scheduler every Monday at 8am.

Usage:
    python Orchestration/jobs/weekly_revenue_report.py
    python Orchestration/jobs/weekly_revenue_report.py --dry-run
    python Orchestration/jobs/weekly_revenue_report.py --week 2026-05-11
"""

import os
import sys
import argparse
import logging
from datetime import date, timedelta
import psycopg2
from dotenv import load_dotenv

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

load_dotenv(os.path.join(ROOT, ".env"))
log = logging.getLogger("weekly_revenue_report")

SYMBOL = "$"


def get_connection():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL not set in .env")
    return psycopg2.connect(db_url)


def fmt(n):
    return f"{SYMBOL}{float(n):,.2f}"


def bar(value, max_value, width=18):
    if max_value == 0:
        return "░" * width
    filled = int((value / max_value) * width)
    return "█" * filled + "░" * (width - filled)


def week_revenue(cur, start: date, end: date) -> list:
    cur.execute("""
        SELECT
            created_at::date AS day,
            COALESCE(SUM(total), 0) AS revenue,
            COUNT(*) AS transactions
        FROM transactions
        WHERE created_at::date BETWEEN %s AND %s
          AND status IN ('completed', 'paid', 'done')
          AND total > 0
        GROUP BY created_at::date
        ORDER BY created_at::date
    """, (start, end))
    return cur.fetchall()


def tech_revenue(cur, start: date, end: date) -> list:
    cur.execute("""
        SELECT
            COALESCE(t.first_name || ' ' || t.last_name, 'Unassigned') AS name,
            COUNT(tx.id) AS services,
            COALESCE(SUM(tx.total), 0) AS revenue
        FROM transactions tx
        LEFT JOIN technicians t ON t.id = tx.technician_id
        WHERE tx.created_at::date BETWEEN %s AND %s
          AND tx.status IN ('completed', 'paid', 'done')
          AND tx.total > 0
        GROUP BY t.first_name, t.last_name
        ORDER BY revenue DESC
    """, (start, end))
    return cur.fetchall()


def no_shows(cur, start: date, end: date) -> tuple:
    cur.execute("""
        SELECT COUNT(*),
               COALESCE(
                   (SELECT AVG(total) FROM transactions
                    WHERE status IN ('completed', 'paid', 'done')
                      AND total > 0
                      AND created_at::date BETWEEN %s AND %s), 0)
        FROM appointments
        WHERE status IN ('no_show', 'no-show', 'cancelled', 'canceled')
          AND start_time::date BETWEEN %s AND %s
    """, (start, end, start, end))
    row = cur.fetchone()
    count = int(row[0])
    avg = float(row[1])
    return count, round(count * avg, 2)


def build_report(cur, week_start: date) -> str:
    week_end = week_start + timedelta(days=6)
    prior_start = week_start - timedelta(days=7)
    prior_end = week_end - timedelta(days=7)

    days = week_revenue(cur, week_start, week_end)
    prior_days = week_revenue(cur, prior_start, prior_end)
    techs = tech_revenue(cur, week_start, week_end)
    ns_count, ns_cost = no_shows(cur, week_start, week_end)

    total = sum(float(r[1]) for r in days)
    prior_total = sum(float(r[1]) for r in prior_days)
    change_pct = ((total - prior_total) / prior_total * 100) if prior_total > 0 else 0
    arrow = "▲" if change_pct >= 0 else "▼"
    day_map = {r[0]: (float(r[1]), int(r[2])) for r in days}
    max_day_rev = max((v[0] for v in day_map.values()), default=1)

    lines = []
    lines.append(f"WEEKLY REVENUE REPORT")
    lines.append(f"Week of {week_start.strftime('%B %d')} – {week_end.strftime('%B %d, %Y')}")
    lines.append("=" * 54)
    lines.append(f"\nTOTAL:  {fmt(total)}   {arrow} {abs(change_pct):.1f}% vs prior week ({fmt(prior_total)})")
    lines.append(f"\nDAILY BREAKDOWN")

    d = week_start
    while d <= week_end:
        rev_d, tx_d = day_map.get(d, (0.0, 0))
        b = bar(rev_d, max_day_rev)
        lines.append(f"  {d.strftime('%a %m/%d')}  {b}  {fmt(rev_d)}  ({tx_d} tx)")
        d += timedelta(days=1)

    if techs:
        lines.append(f"\nBY TECHNICIAN")
        for name, svcs, rev in techs:
            pct = (float(rev) / total * 100) if total > 0 else 0
            lines.append(f"  {name:<22} {svcs:>4} svcs   {fmt(float(rev)):>10}  ({pct:.1f}%)")

    if ns_count > 0:
        lines.append(f"\nNO-SHOWS / CANCELS:  {ns_count}  (~{fmt(ns_cost)} lost revenue)")

    lines.append(f"\n{'─'*54}")
    lines.append(f"Automated Weekly Report — {os.getenv('BUSINESS_NAME', 'Your Business')}")
    lines.append(f"Full P&L: python Financial/tools/pl_report.py --monthly")
    return "\n".join(lines)


def run(dry_run: bool = False, week_start: date = None) -> int:
    if week_start is None:
        today = date.today()
        week_start = today - timedelta(days=today.weekday() + 7)  # prior Monday

    from Orchestration.tools.integrations.sendgrid_client import send_owner_email

    try:
        conn = get_connection()
        cur = conn.cursor()
        report = build_report(cur, week_start)
        cur.close()
        conn.close()
    except Exception as e:
        log.error(f"Failed to build report: {e}")
        return 0

    subject = f"Weekly Revenue — {week_start.strftime('%b %d')} to {(week_start + timedelta(days=6)).strftime('%b %d')}"

    if dry_run:
        print(report)
        return 1

    result = send_owner_email(subject, report)
    if result["success"]:
        log.info("[weekly_revenue] Report sent ✅")
        return 1
    else:
        log.error(f"[weekly_revenue] Send failed: {result['error']}")
        return 0


def main():
    parser = argparse.ArgumentParser(description="Weekly revenue report sender.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--week", type=str, help="Week start date YYYY-MM-DD")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    week_start = date.fromisoformat(args.week) if args.week else None
    run(dry_run=args.dry_run, week_start=week_start)


if __name__ == "__main__":
    main()
