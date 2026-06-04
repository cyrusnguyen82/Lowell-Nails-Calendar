"""
monthly_payroll.py

Calculates commissions for all technicians for the prior calendar month
and emails the payroll report to the business owner.

Called automatically by the scheduler on the 1st of every month at 9:30am.

Usage:
    python Orchestration/jobs/monthly_payroll.py
    python Orchestration/jobs/monthly_payroll.py --dry-run
    python Orchestration/jobs/monthly_payroll.py --month 2026-05
"""

import os
import sys
import csv
import argparse
import logging
from datetime import date, timedelta, datetime
import psycopg2
from dotenv import load_dotenv

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

load_dotenv(os.path.join(ROOT, ".env"))
log = logging.getLogger("monthly_payroll")

OVERRIDES_FILE = os.path.join(ROOT, ".tmp", "payroll_overrides.csv")
PAYROLL_LOG = os.path.join(ROOT, ".tmp", "payroll_log.csv")
SYMBOL = "$"
DEFAULT_COMMISSION = float(os.getenv("DEFAULT_COMMISSION_RATE", 0.45))


def get_connection():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL not set in .env")
    return psycopg2.connect(db_url)


def fmt(n):
    return f"{SYMBOL}{float(n):,.2f}"


def load_overrides() -> dict:
    overrides = {}
    if not os.path.exists(OVERRIDES_FILE):
        return overrides
    with open(OVERRIDES_FILE, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            tid = int(row["technician_id"])
            overrides[tid] = {
                "rate": float(row.get("commission_rate", DEFAULT_COMMISSION)),
                "model": row.get("model", "flat"),
                "tiers": row.get("tiers", ""),
                # hourly support: pay_type = commission | hourly | hybrid
                "pay_type": row.get("pay_type", "commission"),
                "hourly_rate": float(row.get("hourly_rate", 0)),
            }
    return overrides


def prior_month_range(ref: date):
    first_of_this_month = ref.replace(day=1)
    last_of_prior = first_of_this_month - timedelta(days=1)
    first_of_prior = last_of_prior.replace(day=1)
    return first_of_prior, last_of_prior


def fetch_tech_hours(cur, start: date, end: date) -> dict:
    """Returns {technician_id: hours_worked} for completed (clocked-out) entries in range."""
    try:
        cur.execute("""
            SELECT technician_id, COALESCE(SUM(hours_worked), 0)
            FROM time_entries
            WHERE clock_in::date BETWEEN %s AND %s
              AND hours_worked IS NOT NULL
            GROUP BY technician_id
        """, (start, end))
        return {row[0]: float(row[1]) for row in cur.fetchall()}
    except Exception:
        return {}


def fetch_tech_revenue(cur, start: date, end: date) -> list:
    cur.execute("""
        SELECT
            t.id,
            t.first_name || ' ' || t.last_name AS name,
            COUNT(tx.id) AS services,
            COALESCE(SUM(tx.total), 0) AS revenue
        FROM technicians t
        LEFT JOIN transactions tx ON tx.technician_id = t.id
            AND tx.created_at::date BETWEEN %s AND %s
            AND tx.status IN ('completed', 'paid', 'done')
            AND tx.total > 0
        GROUP BY t.id, t.first_name, t.last_name
        ORDER BY revenue DESC
    """, (start, end))
    return cur.fetchall()


def calc_commission(revenue: float, override: dict) -> float:
    model = override.get("model", "flat")
    rate = override.get("rate", DEFAULT_COMMISSION)
    if model == "tiered" and override.get("tiers"):
        tiers = []
        for tier in override["tiers"].split("|"):
            parts = tier.split(":")
            if len(parts) == 3:
                tiers.append((float(parts[0]), float(parts[1]), float(parts[2])))
        tiers.sort()
        commission = 0.0
        remaining = revenue
        for low, high, r in tiers:
            if remaining <= 0:
                break
            chunk = min(remaining, high - low + 1)
            commission += chunk * r
            remaining -= chunk
        return commission
    return revenue * rate


def build_report(rows, overrides, hours_by_tech, start, end) -> tuple:
    lines = []
    lines.append(f"PAYROLL REPORT — {start.strftime('%B %Y')}")
    lines.append(f"{os.getenv('BUSINESS_NAME', 'Your Business')}")
    lines.append(f"Period: {start} to {end}")
    lines.append("=" * 66)
    lines.append(f"\n  {'Name':<22} {'Svcs':>5} {'Revenue':>10} {'Hrs':>6} {'Commission':>12} {'Hourly':>8} {'Total':>10}")
    lines.append(f"  {'─'*22} {'─'*5} {'─'*10} {'─'*6} {'─'*12} {'─'*8} {'─'*10}")

    total_rev = 0.0
    total_pay = 0.0
    payroll_rows = []

    for tech_id, name, svcs, revenue in rows:
        revenue = float(revenue)
        hours = hours_by_tech.get(tech_id, 0.0)
        override = overrides.get(tech_id, {"rate": DEFAULT_COMMISSION, "model": "flat", "pay_type": "commission", "hourly_rate": 0})
        pay_type = override.get("pay_type", "commission")
        hourly_rate = override.get("hourly_rate", 0.0)

        commission = 0.0
        hourly_pay = 0.0

        if pay_type in ("commission", "hybrid"):
            commission = calc_commission(revenue, override)
        if pay_type in ("hourly", "hybrid"):
            hourly_pay = hours * hourly_rate

        tech_total = commission + hourly_pay
        hrs_display = f"{hours:.1f}" if hours > 0 else "—"

        total_rev += revenue
        total_pay += tech_total
        lines.append(
            f"  {name:<22} {svcs:>5} {fmt(revenue):>10} {hrs_display:>6} "
            f"{fmt(commission):>12} {fmt(hourly_pay):>8} {fmt(tech_total):>10}"
        )
        payroll_rows.append((tech_id, name, svcs, revenue, tech_total))

    business_keeps = total_rev - total_pay
    retention_pct = (business_keeps / total_rev * 100) if total_rev > 0 else 0

    lines.append(f"  {'─'*66}")
    lines.append(f"  {'TOTAL':<22} {'':>5} {fmt(total_rev):>10} {'':>6} {'':>12} {'':>8} {fmt(total_pay):>10}")
    lines.append(f"\n  Business retains: {fmt(business_keeps)} ({retention_pct:.1f}%)")
    lines.append(f"\n{'─'*66}")
    lines.append(f"ACTION REQUIRED:")
    lines.append(f"  Issue payments to each technician listed above.")
    lines.append(f"  Then log each payment:")
    lines.append(f"  python Financial/tools/payroll_commission.py --log-payment ...")
    lines.append(f"\nAutomated Payroll Report — {os.getenv('BUSINESS_NAME', 'Your Business')}")

    return "\n".join(lines), payroll_rows


def run(dry_run: bool = False, month_str: str = None) -> int:
    from Orchestration.tools.integrations.sendgrid_client import send_owner_email

    if month_str:
        ref = datetime.strptime(month_str, "%Y-%m").date()
    else:
        ref = date.today()

    start, end = prior_month_range(ref)

    try:
        conn = get_connection()
        cur = conn.cursor()
        overrides = load_overrides()
        rows = fetch_tech_revenue(cur, start, end)
        hours_by_tech = fetch_tech_hours(cur, start, end)
        cur.close()
        conn.close()
    except Exception as e:
        log.error(f"DB error: {e}")
        return 0

    report, payroll_rows = build_report(rows, overrides, hours_by_tech, start, end)
    subject = f"Payroll Ready — {start.strftime('%B %Y')}"

    if dry_run:
        print(report)
        return 1

    result = send_owner_email(subject, report)
    if result["success"]:
        log.info(f"[monthly_payroll] Report sent for {start.strftime('%B %Y')} ✅")
        return 1
    else:
        log.error(f"[monthly_payroll] Send failed: {result['error']}")
        return 0


def main():
    parser = argparse.ArgumentParser(description="Monthly payroll report sender.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--month", type=str, help="Month YYYY-MM")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    run(dry_run=args.dry_run, month_str=args.month)


if __name__ == "__main__":
    main()
