"""
daily_revenue.py

Pulls revenue data from the POS transactions table and prints a dashboard.

Usage:
    python Financial/tools/daily_revenue.py                  # today
    python Financial/tools/daily_revenue.py --weekly         # last 7 days
    python Financial/tools/daily_revenue.py --monthly        # current calendar month
    python Financial/tools/daily_revenue.py --date 2026-05-15
"""

import os
import argparse
from datetime import date, timedelta
import psycopg2
from dotenv import load_dotenv

load_dotenv()

CURRENCY = os.getenv("CURRENCY", "USD")
SYMBOL = "$"
TARGET = float(os.getenv("MONTHLY_REVENUE_TARGET", 0))


def get_connection():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL not set in .env")
    return psycopg2.connect(db_url)


def fmt(amount):
    return f"{SYMBOL}{amount:,.2f}"


def revenue_for_period(cur, start: date, end: date):
    """Gross revenue, discounts, refunds, net revenue."""
    cur.execute("""
        SELECT
            COALESCE(SUM(CASE WHEN total > 0 THEN total ELSE 0 END), 0) AS gross,
            COALESCE(SUM(CASE WHEN total < 0 THEN ABS(total) ELSE 0 END), 0) AS refunds,
            COALESCE(SUM(CASE WHEN discount_amount IS NOT NULL THEN discount_amount ELSE 0 END), 0) AS discounts,
            COUNT(CASE WHEN total > 0 THEN 1 END) AS tx_count
        FROM transactions
        WHERE created_at::date BETWEEN %s AND %s
          AND status IN ('completed', 'paid', 'done')
    """, (start, end))
    row = cur.fetchone()
    gross = float(row[0])
    refunds = float(row[1])
    discounts = float(row[2])
    tx_count = int(row[3])
    net = gross - refunds - discounts
    return {"gross": gross, "refunds": refunds, "discounts": discounts, "net": net, "tx_count": tx_count}


def revenue_by_technician(cur, start: date, end: date):
    cur.execute("""
        SELECT
            COALESCE(t.first_name || ' ' || LEFT(t.last_name, 1) || '.', 'Unknown') AS tech_name,
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


def no_show_cost(cur, start: date, end: date):
    """Estimate revenue lost to no-shows and last-minute cancellations."""
    cur.execute("""
        SELECT
            COUNT(*) AS no_shows,
            COALESCE(
                (SELECT AVG(total) FROM transactions
                 WHERE status IN ('completed', 'paid', 'done')
                   AND created_at::date BETWEEN %s AND %s
                   AND total > 0), 0
            ) AS avg_tx
        FROM appointments
        WHERE status IN ('no_show', 'no-show', 'cancelled', 'canceled')
          AND start_time::date BETWEEN %s AND %s
    """, (start, end, start, end))
    row = cur.fetchone()
    count = int(row[0])
    avg = float(row[1])
    return count, round(count * avg, 2)


def daily_breakdown(cur, start: date, end: date):
    """Day-by-day revenue for the period."""
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


def bar(value, max_value, width=20):
    if max_value == 0:
        return " " * width
    filled = int((value / max_value) * width)
    return "█" * filled + "░" * (width - filled)


def print_daily_report(cur, target_date: date):
    w = 56
    print("\n" + "=" * w)
    print(f"  DAILY REVENUE — {target_date.strftime('%A, %B %d, %Y')}")
    print("=" * w)

    rev = revenue_for_period(cur, target_date, target_date)
    prior = revenue_for_period(cur, target_date - timedelta(days=7), target_date - timedelta(days=7))

    print(f"\n  Gross Revenue      {fmt(rev['gross']):>12}")
    if rev['discounts'] > 0:
        print(f"  Discounts          {fmt(-rev['discounts']):>12}")
    if rev['refunds'] > 0:
        print(f"  Refunds            {fmt(-rev['refunds']):>12}")
    print(f"  Net Revenue        {fmt(rev['net']):>12}")
    print(f"  Transactions       {rev['tx_count']:>12}")

    if prior['net'] > 0:
        change = rev['net'] - prior['net']
        pct = (change / prior['net']) * 100
        arrow = "▲" if change >= 0 else "▼"
        print(f"  vs. Last Week      {fmt(prior['net']):>12}  {arrow} {abs(pct):.1f}%")

    ns_count, ns_cost = no_show_cost(cur, target_date, target_date)
    if ns_count > 0:
        print(f"\n  ⚠ No-shows/cancels  {ns_count:>11}  (~{fmt(ns_cost)} lost)")

    techs = revenue_by_technician(cur, target_date, target_date)
    if techs:
        print(f"\n  BY TECHNICIAN")
        print(f"  {'Name':<20} {'Services':>8} {'Revenue':>10}")
        print(f"  {'-'*20} {'-'*8} {'-'*10}")
        for name, svcs, rev_t in techs:
            print(f"  {name:<20} {svcs:>8} {fmt(float(rev_t)):>10}")

    print()


def print_weekly_report(cur, end_date: date):
    start = end_date - timedelta(days=6)
    w = 56
    print("\n" + "=" * w)
    print(f"  WEEKLY REVENUE — {start.strftime('%b %d')} to {end_date.strftime('%b %d, %Y')}")
    print("=" * w)

    rows = daily_breakdown(cur, start, end_date)
    day_map = {r[0]: (float(r[1]), int(r[2])) for r in rows}

    total = sum(v[0] for v in day_map.values())
    max_day = max((v[0] for v in day_map.values()), default=1)

    print()
    d = start
    while d <= end_date:
        rev_d, txn_d = day_map.get(d, (0.0, 0))
        b = bar(rev_d, max_day)
        marker = " ◀ today" if d == date.today() else ""
        print(f"  {d.strftime('%a %m/%d')}  {b}  {fmt(rev_d)}{marker}")
        d += timedelta(days=1)

    print(f"\n  Total 7-day revenue:  {fmt(total)}")

    prior_start = start - timedelta(days=7)
    prior_end = end_date - timedelta(days=7)
    prior_rev = revenue_for_period(cur, prior_start, prior_end)
    if prior_rev['net'] > 0:
        change_pct = ((total - prior_rev['net']) / prior_rev['net']) * 100
        arrow = "▲" if change_pct >= 0 else "▼"
        print(f"  Prior week:           {fmt(prior_rev['net'])}  {arrow} {abs(change_pct):.1f}%")

    print()


def print_monthly_report(cur, ref_date: date):
    start = ref_date.replace(day=1)
    end = ref_date
    w = 56
    print("\n" + "=" * w)
    print(f"  MONTHLY REVENUE — {start.strftime('%B %Y')}")
    print("=" * w)

    rev = revenue_for_period(cur, start, end)
    rows = daily_breakdown(cur, start, end)

    print(f"\n  MTD Net Revenue:   {fmt(rev['net'])}")
    print(f"  MTD Transactions:  {rev['tx_count']}")

    if TARGET > 0:
        pct_of_target = (rev['net'] / TARGET) * 100
        days_elapsed = (end - start).days + 1
        days_in_month = (start.replace(month=start.month % 12 + 1, day=1) - timedelta(days=1)).day
        days_left = days_in_month - days_elapsed
        daily_avg = rev['net'] / days_elapsed if days_elapsed > 0 else 0
        projected = rev['net'] + (daily_avg * days_left)
        print(f"\n  Monthly Target:    {fmt(TARGET)}")
        print(f"  Progress:          {pct_of_target:.1f}% of target")
        print(f"  Projected Month-End: {fmt(projected)}")

    if rows:
        print(f"\n  Daily breakdown:")
        max_rev = max(float(r[1]) for r in rows)
        for day, rev_d, txn_d in rows:
            b = bar(float(rev_d), max_rev, width=15)
            print(f"  {day.strftime('%d')}  {b}  {fmt(float(rev_d))}")

    print()


def main():
    parser = argparse.ArgumentParser(description="Daily revenue dashboard.")
    parser.add_argument("--weekly", action="store_true")
    parser.add_argument("--monthly", action="store_true")
    parser.add_argument("--date", type=str, help="Specific date YYYY-MM-DD")
    args = parser.parse_args()

    target_date = date.fromisoformat(args.date) if args.date else date.today()

    try:
        conn = get_connection()
    except Exception as e:
        print(f"DB connection failed: {e}")
        return

    cur = conn.cursor()
    try:
        if args.weekly:
            print_weekly_report(cur, target_date)
        elif args.monthly:
            print_monthly_report(cur, target_date)
        else:
            print_daily_report(cur, target_date)
    except psycopg2.errors.UndefinedTable:
        print("\nWarning: 'transactions' table not found.")
        print("Revenue data requires completed POS transactions in the DB.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
