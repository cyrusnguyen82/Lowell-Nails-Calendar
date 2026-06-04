"""
cash_flow_alert.py

Checks the 4-week cash flow projection and sends an urgent alert email
to the owner if any week is projected to fall below CASH_ALERT_THRESHOLD.

Runs silently (no email) when cash position is healthy.
Called daily at 8am alongside the morning briefing.

Usage:
    python Orchestration/jobs/cash_flow_alert.py
    python Orchestration/jobs/cash_flow_alert.py --dry-run
    python Orchestration/jobs/cash_flow_alert.py --weeks 8
"""

import os
import sys
import csv
import argparse
import logging
from datetime import date, timedelta
import psycopg2
from dotenv import load_dotenv

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

load_dotenv(os.path.join(ROOT, ".env"))
log = logging.getLogger("cash_flow_alert")

EXPENSES_FILE = os.path.join(ROOT, ".tmp", "expenses.csv")
SYMBOL = "$"


def get_connection():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL not set in .env")
    return psycopg2.connect(db_url)


def fmt(n):
    return f"{SYMBOL}{float(n):,.2f}"


def get_weekly_fixed_costs() -> float:
    rent = float(os.getenv("RENT_MONTHLY", 0))
    other = float(os.getenv("OTHER_FIXED_COSTS", 0))
    recurring_monthly = 0.0
    if os.path.exists(EXPENSES_FILE):
        with open(EXPENSES_FILE, "r", newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            seen = {}
            for row in reader:
                if row.get("recurring") == "yes" and row.get("personal", "no") != "yes":
                    key = (row["category"], row["note"])
                    seen[key] = float(row["amount"])
            recurring_monthly = sum(seen.values())
    return (rent + other + recurring_monthly) / 4.33


def get_avg_weekly_revenue(cur) -> float:
    eight_weeks_ago = date.today() - timedelta(weeks=8)
    cur.execute("""
        SELECT COALESCE(SUM(total), 0) / 8.0
        FROM transactions
        WHERE created_at::date >= %s
          AND status IN ('completed', 'paid', 'done')
          AND total > 0
    """, (eight_weeks_ago,))
    row = cur.fetchone()
    return float(row[0]) if row else 0.0


def project_weeks(avg_weekly_rev: float, weekly_fixed: float,
                  cash_on_hand: float, num_weeks: int) -> list:
    weeks = []
    balance = cash_on_hand
    today = date.today()
    week_start = today - timedelta(days=today.weekday())

    for i in range(num_weeks):
        ws = week_start + timedelta(weeks=i)
        we = ws + timedelta(days=6)
        net = avg_weekly_rev - weekly_fixed
        balance += net
        weeks.append({
            "week_num": i + 1,
            "start": ws,
            "end": we,
            "revenue": avg_weekly_rev,
            "expenses": weekly_fixed,
            "net": net,
            "balance": balance,
        })
    return weeks


def build_alert_message(alert_weeks: list, all_weeks: list) -> str:
    business = os.getenv("BUSINESS_NAME", "Your Business")
    lines = []
    lines.append(f"⚠ CASH FLOW ALERT — {business}")
    lines.append(f"Generated: {date.today()}")
    lines.append("=" * 54)
    lines.append(f"\n{len(alert_weeks)} week(s) projected below alert threshold:\n")

    threshold = float(os.getenv("CASH_ALERT_THRESHOLD", 0))
    for w in alert_weeks:
        lines.append(
            f"  Week {w['week_num']} ({w['start'].strftime('%b %d')}–{w['end'].strftime('%b %d')}): "
            f"Balance {fmt(w['balance'])}  (threshold: {fmt(threshold)})"
        )

    lines.append(f"\nFULL 4-WEEK PROJECTION:")
    lines.append(f"  {'Wk':<4} {'Dates':<16} {'Revenue':>10} {'Expenses':>10} {'Net':>8} {'Balance':>10}")
    for w in all_weeks:
        flag = " ⚠" if w["balance"] < threshold else ""
        lines.append(
            f"  W{w['week_num']:<3} "
            f"{w['start'].strftime('%b %d')}-{w['end'].strftime('%b %d'):<9} "
            f"{fmt(w['revenue']):>10} {fmt(w['expenses']):>10} "
            f"{fmt(w['net']):>8} {fmt(w['balance']):>10}{flag}"
        )

    lines.append(f"\nACTION OPTIONS:")
    lines.append(f"  1. Run a promotion to increase revenue before the shortfall week")
    lines.append(f"     → See: marketing/workflows/05_reactivation_campaign.md")
    lines.append(f"  2. Defer variable expenses to a later week")
    lines.append(f"  3. Build cash reserve — target: 3x monthly fixed costs")
    lines.append(f"\nFull forecast: python Financial/tools/cash_flow_forecast.py --cash-on-hand XXXX")
    return "\n".join(lines)


def run(dry_run: bool = False, num_weeks: int = 4) -> int:
    threshold = float(os.getenv("CASH_ALERT_THRESHOLD", 0))
    if threshold == 0:
        log.info("[cash_flow_alert] CASH_ALERT_THRESHOLD not set — skipping")
        return 0

    from Orchestration.tools.integrations.sendgrid_client import send_owner_email

    try:
        conn = get_connection()
        cur = conn.cursor()
        avg_rev = get_avg_weekly_revenue(cur)
        cur.close()
        conn.close()
    except Exception as e:
        log.warning(f"[cash_flow_alert] DB error (using estimate): {e}")
        avg_rev = 0.0

    weekly_fixed = get_weekly_fixed_costs()
    # Use 0 as cash on hand if not specified — owner should pass actual value to forecast tool
    weeks = project_weeks(avg_rev, weekly_fixed, cash_on_hand=0, num_weeks=num_weeks)
    alert_weeks = [w for w in weeks if w["balance"] < threshold]

    if not alert_weeks:
        log.info(f"[cash_flow_alert] Cash position healthy — no alert needed")
        return 0

    message = build_alert_message(alert_weeks, weeks)
    subject = f"⚠ Cash Flow Alert — {len(alert_weeks)} week(s) below threshold"

    if dry_run:
        print(message)
        return 1

    result = send_owner_email(subject, message)
    if result["success"]:
        log.info(f"[cash_flow_alert] Alert sent — {len(alert_weeks)} flagged week(s)")
        return 1
    else:
        log.error(f"[cash_flow_alert] Send failed: {result['error']}")
        return 0


def main():
    parser = argparse.ArgumentParser(description="Cash flow alert checker.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--weeks", type=int, default=4, help="Weeks to project (default: 4)")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    run(dry_run=args.dry_run, num_weeks=args.weeks)


if __name__ == "__main__":
    main()
