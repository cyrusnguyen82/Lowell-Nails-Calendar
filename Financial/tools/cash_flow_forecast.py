"""
cash_flow_forecast.py

Generates a 13-week rolling cash flow forecast using:
- Confirmed appointments (weeks 1-2) from DB
- Trailing 8-week daily average (weeks 3-8)
- Trend-adjusted estimate (weeks 9-13)
- Fixed costs overlay from .env and expense log

Usage:
    python Financial/tools/cash_flow_forecast.py
    python Financial/tools/cash_flow_forecast.py --cash-on-hand 8500
    python Financial/tools/cash_flow_forecast.py --alert-threshold 2000
    python Financial/tools/cash_flow_forecast.py --weeks 8
"""

import os
import csv
import argparse
from datetime import date, timedelta
from collections import defaultdict
import psycopg2
from dotenv import load_dotenv

load_dotenv()

EXPENSES_FILE = ".tmp/expenses.csv"
SYMBOL = "$"


def get_connection():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL not set in .env")
    return psycopg2.connect(db_url)


def fmt(amount):
    return f"{SYMBOL}{amount:,.2f}"


def get_fixed_weekly_costs():
    """Pull fixed monthly costs from .env and divide by ~4.33 weeks/month."""
    rent = float(os.getenv("RENT_MONTHLY", 0))
    other = float(os.getenv("OTHER_FIXED_COSTS", 0))

    # Pull recurring expenses from expense log
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

    total_monthly = rent + other + recurring_monthly
    return total_monthly / 4.33


def get_trailing_weekly_revenue(cur, weeks=8):
    """Average weekly revenue over the past N weeks."""
    end = date.today() - timedelta(days=1)
    start = end - timedelta(weeks=weeks)
    cur.execute("""
        SELECT
            DATE_TRUNC('week', created_at)::date AS week_start,
            COALESCE(SUM(total), 0) AS weekly_rev
        FROM transactions
        WHERE created_at::date BETWEEN %s AND %s
          AND status IN ('completed', 'paid', 'done')
          AND total > 0
        GROUP BY DATE_TRUNC('week', created_at)
        ORDER BY week_start
    """, (start, end))
    rows = cur.fetchall()
    if not rows:
        return 0.0, 0.0
    revenues = [float(r[1]) for r in rows]
    avg = sum(revenues) / len(revenues)
    # MoM trend: compare first half to second half
    mid = len(revenues) // 2
    if mid > 0 and sum(revenues[:mid]) > 0:
        trend = (sum(revenues[mid:]) / len(revenues[mid:])) / (sum(revenues[:mid]) / len(revenues[:mid]))
    else:
        trend = 1.0
    return avg, trend


def get_confirmed_revenue(cur, start: date, end: date):
    """Revenue from confirmed upcoming appointments (average ticket * count)."""
    cur.execute("""
        SELECT
            a.start_time::date AS appt_date,
            COUNT(a.id) AS count,
            COALESCE(
                (SELECT AVG(total) FROM transactions
                 WHERE status IN ('completed', 'paid', 'done')
                   AND total > 0
                   AND created_at::date >= CURRENT_DATE - INTERVAL '30 days'),
                0
            ) AS avg_ticket
        FROM appointments a
        WHERE a.start_time::date BETWEEN %s AND %s
          AND a.status IN ('confirmed', 'scheduled', 'booked')
        GROUP BY a.start_time::date
        ORDER BY a.start_time::date
    """, (start, end))
    rows = cur.fetchall()
    by_week = defaultdict(float)
    for appt_date, count, avg_ticket in rows:
        # Group into ISO week
        week_start = appt_date - timedelta(days=appt_date.weekday())
        by_week[week_start] += count * float(avg_ticket)
    return by_week


def get_scheduled_expenses(start: date, weeks: int):
    """Pull future-dated expenses from the expense log."""
    if not os.path.exists(EXPENSES_FILE):
        return defaultdict(float)
    by_week = defaultdict(float)
    end = start + timedelta(weeks=weeks)
    with open(EXPENSES_FILE, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("personal", "no") == "yes":
                continue
            try:
                exp_date = date.fromisoformat(row["date"])
            except (ValueError, KeyError):
                continue
            if start <= exp_date <= end:
                week_start = exp_date - timedelta(days=exp_date.weekday())
                by_week[week_start] += float(row["amount"])
    return by_week


def print_forecast(weeks_data: list, cash_balance: float, alert_threshold: float):
    w = 72
    reserve_target = float(os.getenv("CASH_RESERVE_TARGET", 0))

    print(f"\n{'='*w}")
    print(f"  13-WEEK CASH FLOW FORECAST — Generated {date.today()}")
    print(f"  Opening Balance: {fmt(cash_balance)}")
    if reserve_target > 0:
        print(f"  Reserve Target:  {fmt(reserve_target)}")
    print(f"{'='*w}")
    print(f"  {'Wk':<4} {'Dates':<16} {'Rev':>10} {'Exp':>10} {'Net':>10} {'Balance':>10}  Status")
    print(f"  {'──':<4} {'──────────────':<16} {'───':<10} {'───':>10} {'───':>10} {'───────':>10}  ──────")

    balance = cash_balance
    for i, week in enumerate(weeks_data):
        revenue = week["revenue"]
        expenses = week["expenses"]
        net = revenue - expenses
        balance += net
        start_str = week["start"].strftime("%b %d")
        end_str = week["end"].strftime("%b %d")
        dates = f"{start_str}-{end_str}"

        if balance < 0:
            status = "🔴 DEFICIT"
        elif alert_threshold > 0 and balance < alert_threshold:
            status = "⚠  ALERT"
        elif reserve_target > 0 and balance < reserve_target:
            status = "⚠  WATCH"
        else:
            status = "✅ OK"

        conf = week.get("confirmed", False)
        src = "C" if conf else "P"  # Confirmed vs Projected
        print(f"  W{i+1:<3} {dates:<16} {fmt(revenue):>10} {fmt(expenses):>10} {fmt(net):>10} {fmt(balance):>10}  {status} [{src}]")

    print(f"\n  [C] = Based on confirmed appointments  [P] = Projected from historical avg")
    if alert_threshold > 0:
        print(f"  Alert threshold: {fmt(alert_threshold)}")
    print()


def main():
    parser = argparse.ArgumentParser(description="13-week cash flow forecast.")
    parser.add_argument("--cash-on-hand", type=float, default=0,
                        help="Current cash balance (default: 0 — add your actual balance)")
    parser.add_argument("--alert-threshold", type=float, default=0,
                        help="Flag weeks where balance drops below this amount.")
    parser.add_argument("--weeks", type=int, default=13, help="Number of weeks to forecast (default: 13)")
    args = parser.parse_args()

    if args.cash_on_hand == 0:
        print("\nTip: Pass --cash-on-hand XXXX with your current bank balance for an accurate forecast.")

    try:
        conn = get_connection()
        cur = conn.cursor()
    except Exception as e:
        print(f"DB connection failed: {e}")
        return

    try:
        avg_weekly_rev, trend = get_trailing_weekly_revenue(cur)
        today = date.today()
        week_start = today - timedelta(days=today.weekday())

        # Get confirmed bookings for next 2 weeks
        confirmed_end = week_start + timedelta(weeks=2, days=6)
        confirmed_by_week = get_confirmed_revenue(cur, week_start, confirmed_end)

        fixed_weekly = get_fixed_weekly_costs()
        scheduled_expenses = get_scheduled_expenses(week_start, args.weeks)

        weeks_data = []
        for i in range(args.weeks):
            ws = week_start + timedelta(weeks=i)
            we = ws + timedelta(days=6)
            is_confirmed = i < 2

            if is_confirmed and ws in confirmed_by_week:
                revenue = confirmed_by_week[ws]
                # Blend with average if confirmed booking revenue seems low
                if revenue < avg_weekly_rev * 0.3:
                    revenue = max(revenue, avg_weekly_rev * 0.5)
            elif i < 8:
                revenue = avg_weekly_rev
            else:
                # Trend-adjusted
                revenue = avg_weekly_rev * (trend ** (i - 7))

            scheduled = scheduled_expenses.get(ws, 0)
            expenses = fixed_weekly + scheduled

            weeks_data.append({
                "start": ws,
                "end": we,
                "revenue": round(revenue, 2),
                "expenses": round(expenses, 2),
                "confirmed": is_confirmed,
            })

        print_forecast(weeks_data, args.cash_on_hand, args.alert_threshold)

    except psycopg2.errors.UndefinedTable:
        print("\nWarning: transactions or appointments table not found.")
        print("The forecast requires historical transaction data and upcoming appointments.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
