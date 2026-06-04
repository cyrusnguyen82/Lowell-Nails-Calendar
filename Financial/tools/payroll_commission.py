"""
payroll_commission.py

Calculates commissions for each technician based on services performed in a pay period.
Supports flat %, tiered %, and hourly + commission models.
Logs payments to .tmp/payroll_log.csv.

Usage:
    python Financial/tools/payroll_commission.py --period monthly
    python Financial/tools/payroll_commission.py --period monthly --month 2026-05
    python Financial/tools/payroll_commission.py --period weekly
    python Financial/tools/payroll_commission.py --period monthly --tech-id 2
    python Financial/tools/payroll_commission.py --period monthly --export
    python Financial/tools/payroll_commission.py --log-payment --tech-id 1 --amount 3120 --date 2026-05-31 --method check
"""

import os
import csv
import argparse
from datetime import date, timedelta, datetime
import psycopg2
from dotenv import load_dotenv

load_dotenv()

OVERRIDES_FILE = ".tmp/payroll_overrides.csv"
PAYROLL_LOG = ".tmp/payroll_log.csv"
SYMBOL = "$"

DEFAULT_COMMISSION = float(os.getenv("DEFAULT_COMMISSION_RATE", 0.45))
PAY_PERIOD_TYPE = os.getenv("PAY_PERIOD", "monthly")


def get_connection():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL not set in .env")
    return psycopg2.connect(db_url)


def fmt(amount):
    return f"{SYMBOL}{amount:,.2f}"


def load_overrides():
    """Load per-technician commission overrides from CSV."""
    overrides = {}
    if not os.path.exists(OVERRIDES_FILE):
        return overrides
    with open(OVERRIDES_FILE, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            tech_id = int(row["technician_id"])
            overrides[tech_id] = {
                "name": row.get("technician_name", ""),
                "rate": float(row.get("commission_rate", DEFAULT_COMMISSION)),
                "model": row.get("model", "flat"),
                "hourly": float(row.get("hourly_rate", 0)),
                "tiers": row.get("tiers", ""),
            }
    return overrides


def period_dates(period_type: str, ref_date: date):
    if period_type == "weekly":
        start = ref_date - timedelta(days=ref_date.weekday())
        end = start + timedelta(days=6)
    elif period_type == "biweekly":
        start = ref_date - timedelta(days=ref_date.weekday())
        start -= timedelta(weeks=1)
        end = start + timedelta(days=13)
    else:  # monthly
        start = ref_date.replace(day=1)
        next_month = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
        end = next_month - timedelta(days=1)
    return start, end


def fetch_tech_revenue(cur, start: date, end: date):
    """Revenue per technician in period."""
    cur.execute("""
        SELECT
            t.id AS tech_id,
            t.first_name || ' ' || t.last_name AS tech_name,
            COUNT(tx.id) AS service_count,
            COALESCE(SUM(tx.total), 0) AS gross_revenue
        FROM technicians t
        LEFT JOIN transactions tx ON tx.technician_id = t.id
            AND tx.created_at::date BETWEEN %s AND %s
            AND tx.status IN ('completed', 'paid', 'done')
            AND tx.total > 0
        GROUP BY t.id, t.first_name, t.last_name
        ORDER BY gross_revenue DESC
    """, (start, end))
    return cur.fetchall()


def calc_tiered_commission(revenue: float, tiers_str: str) -> float:
    """
    Parse tier string like "0:3000:0.40|3001:5000:0.45|5001:99999:0.50"
    and calculate commission.
    """
    if not tiers_str:
        return revenue * DEFAULT_COMMISSION
    tiers = []
    for tier in tiers_str.split("|"):
        parts = tier.split(":")
        if len(parts) == 3:
            tiers.append((float(parts[0]), float(parts[1]), float(parts[2])))
    tiers.sort()
    commission = 0.0
    remaining = revenue
    for low, high, rate in tiers:
        if remaining <= 0:
            break
        tier_rev = min(remaining, high - low + 1)
        commission += tier_rev * rate
        remaining -= tier_rev
    return commission


def print_payroll_report(rows, overrides, start, end, period_type, filter_tech_id=None):
    w = 62
    print(f"\n{'='*w}")
    print(f"  PAYROLL / COMMISSION REPORT")
    print(f"  Period: {start} to {end}  ({period_type})")
    print(f"{'='*w}")
    print(f"  {'Name':<22} {'Svcs':>5} {'Revenue':>10} {'Rate':>6} {'Commission':>12}")
    print(f"  {'─'*22} {'─'*5} {'─'*10} {'─'*6} {'─'*12}")

    total_revenue = 0.0
    total_commission = 0.0
    payroll_entries = []

    for tech_id, tech_name, svc_count, gross_rev in rows:
        if filter_tech_id and tech_id != filter_tech_id:
            continue

        override = overrides.get(tech_id, {})
        model = override.get("model", "flat")
        rate = override.get("rate", DEFAULT_COMMISSION)
        hourly = override.get("hourly", 0.0)
        tiers_str = override.get("tiers", "")

        gross_rev = float(gross_rev)

        if model == "tiered" and tiers_str:
            commission = calc_tiered_commission(gross_rev, tiers_str)
            rate_display = "tiered"
        else:
            commission = gross_rev * rate
            rate_display = f"{rate*100:.0f}%"

        if hourly > 0:
            # Hourly base requires manual hours input (not tracked here)
            rate_display = f"+{rate*100:.0f}%"

        total_revenue += gross_rev
        total_commission += commission

        name_short = tech_name[:22]
        print(f"  {name_short:<22} {svc_count:>5} {fmt(gross_rev):>10} {rate_display:>6} {fmt(commission):>12}")
        payroll_entries.append({
            "tech_id": tech_id,
            "tech_name": tech_name,
            "services": svc_count,
            "revenue": gross_rev,
            "commission": round(commission, 2),
        })

    business_keeps = total_revenue - total_commission
    retention_pct = (business_keeps / total_revenue * 100) if total_revenue > 0 else 0

    print(f"  {'─'*62}")
    print(f"  {'TOTAL':<22} {'':>5} {fmt(total_revenue):>10} {'':>6} {fmt(total_commission):>12}")
    print(f"\n  Business retains:  {fmt(business_keeps)}  ({retention_pct:.1f}% of revenue)")
    print(f"{'='*w}\n")

    return payroll_entries


def export_payroll_csv(entries, start, end, output_dir=".tmp"):
    os.makedirs(output_dir, exist_ok=True)
    filepath = os.path.join(output_dir, f"payroll_{start}_{end}.csv")
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["tech_id", "tech_name", "services", "revenue", "commission"])
        writer.writeheader()
        writer.writerows(entries)
    print(f"  Exported to: {filepath}")


def log_payment(tech_id: int, amount: float, payment_date: date, method: str, cur):
    cur.execute("SELECT first_name || ' ' || last_name FROM technicians WHERE id = %s", (tech_id,))
    row = cur.fetchone()
    name = row[0] if row else f"Tech ID {tech_id}"

    os.makedirs(os.path.dirname(PAYROLL_LOG) or ".", exist_ok=True)
    file_exists = os.path.exists(PAYROLL_LOG)
    with open(PAYROLL_LOG, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(["payment_date", "tech_id", "tech_name", "amount", "method", "logged_at"])
        writer.writerow([payment_date.isoformat(), tech_id, name, amount, method, date.today().isoformat()])

    print(f"\nPayment logged: {fmt(amount)} to {name} via {method} on {payment_date}")
    print(f"Record saved to: {PAYROLL_LOG}")


def main():
    parser = argparse.ArgumentParser(description="Payroll and commission calculator.")
    parser.add_argument("--period", choices=["weekly", "biweekly", "monthly"], default=PAY_PERIOD_TYPE)
    parser.add_argument("--month", type=str, help="Reference month YYYY-MM (for monthly period).")
    parser.add_argument("--tech-id", type=int, help="Filter to a single technician.")
    parser.add_argument("--export", action="store_true", help="Export commission report to CSV.")
    parser.add_argument("--log-payment", action="store_true", help="Log a payment made.")
    parser.add_argument("--amount", type=float, help="Payment amount (for --log-payment).")
    parser.add_argument("--date", type=str, help="Payment date YYYY-MM-DD.")
    parser.add_argument("--method", default="check", help="Payment method (check, zelle, direct_deposit).")
    args = parser.parse_args()

    try:
        conn = get_connection()
        cur = conn.cursor()
    except Exception as e:
        print(f"DB connection failed: {e}")
        return

    try:
        if args.log_payment:
            if not args.tech_id or not args.amount:
                print("--log-payment requires --tech-id and --amount")
                return
            payment_date = date.fromisoformat(args.date) if args.date else date.today()
            log_payment(args.tech_id, args.amount, payment_date, args.method, cur)
            return

        if args.month:
            ref_date = datetime.strptime(args.month, "%Y-%m").date()
        else:
            ref_date = date.today()

        start, end = period_dates(args.period, ref_date)
        overrides = load_overrides()
        rows = fetch_tech_revenue(cur, start, end)

        entries = print_payroll_report(rows, overrides, start, end, args.period, args.tech_id)

        if args.export:
            export_payroll_csv(entries, start, end)

    except psycopg2.errors.UndefinedTable:
        print("\nWarning: technicians or transactions table not found.")
        print("Payroll requires technician and transaction data in the DB.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
