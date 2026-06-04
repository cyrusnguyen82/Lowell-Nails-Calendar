"""
pl_report.py

Generates a full Profit & Loss statement by combining:
- Revenue from the POS transactions table
- Commissions from payroll calculation
- Expenses from .tmp/expenses.csv

Usage:
    python Financial/tools/pl_report.py                    # current month
    python Financial/tools/pl_report.py --monthly
    python Financial/tools/pl_report.py --monthly --month 2026-04
    python Financial/tools/pl_report.py --weekly
    python Financial/tools/pl_report.py --ytd
    python Financial/tools/pl_report.py --year 2026
    python Financial/tools/pl_report.py --year 2026 --export
"""

import os
import csv
import argparse
from datetime import date, timedelta, datetime
from collections import defaultdict
import psycopg2
from dotenv import load_dotenv

load_dotenv()

EXPENSES_FILE = ".tmp/expenses.csv"
SYMBOL = "$"
BUSINESS_NAME = os.getenv("BUSINESS_NAME", "Your Business")
DEFAULT_COMMISSION = float(os.getenv("DEFAULT_COMMISSION_RATE", 0.45))


def get_connection():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL not set in .env")
    return psycopg2.connect(db_url)


def fmt(amount, width=12):
    return f"{SYMBOL}{amount:,.2f}".rjust(width)


def revenue_data(cur, start: date, end: date) -> dict:
    cur.execute("""
        SELECT
            COALESCE(SUM(CASE WHEN total > 0 THEN total ELSE 0 END), 0) AS gross,
            COALESCE(SUM(CASE WHEN total < 0 THEN ABS(total) ELSE 0 END), 0) AS refunds,
            COALESCE(SUM(CASE WHEN discount_amount IS NOT NULL THEN discount_amount ELSE 0 END), 0) AS discounts,
            COALESCE(SUM(CASE WHEN total > 0 THEN total ELSE 0 END), 0) AS total_revenue
        FROM transactions
        WHERE created_at::date BETWEEN %s AND %s
          AND status IN ('completed', 'paid', 'done')
    """, (start, end))
    row = cur.fetchone()
    gross = float(row[0])
    refunds = float(row[1])
    discounts = float(row[2])
    net = gross - refunds - discounts
    return {"gross": gross, "refunds": refunds, "discounts": discounts, "net": net}


def commission_total(cur, start: date, end: date) -> float:
    """Sum all commissions paid (commission_rate * service revenue per tech)."""
    cur.execute("""
        SELECT COALESCE(SUM(tx.total), 0) AS total_rev
        FROM transactions tx
        WHERE tx.created_at::date BETWEEN %s AND %s
          AND tx.status IN ('completed', 'paid', 'done')
          AND tx.total > 0
    """, (start, end))
    total_rev = float(cur.fetchone()[0])
    return total_rev * DEFAULT_COMMISSION


def expenses_by_category(start: date, end: date) -> dict:
    if not os.path.exists(EXPENSES_FILE):
        return {}
    by_cat = defaultdict(float)
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
                cat = row.get("category", "misc")
                if cat not in ("payroll",):  # Payroll handled separately
                    by_cat[cat] += float(row["amount"])
    return dict(by_cat)


def print_pl(revenue: dict, commission: float, expenses: dict, label: str, start: date, end: date):
    w = 54
    cogs = expenses.pop("supplies", 0.0) + expenses.pop("retail", 0.0)
    gross_profit = revenue["net"] - cogs
    gp_margin = (gross_profit / revenue["net"] * 100) if revenue["net"] > 0 else 0

    total_opex = commission + sum(expenses.values())
    net_profit = gross_profit - total_opex
    net_margin = (net_profit / revenue["net"] * 100) if revenue["net"] > 0 else 0

    print(f"\n{'═'*w}")
    print(f"  PROFIT & LOSS — {label}")
    print(f"  {BUSINESS_NAME}   |   {start} to {end}")
    print(f"{'═'*w}")

    print(f"\n  REVENUE")
    print(f"  Gross Revenue          {fmt(revenue['gross'])}")
    if revenue["discounts"] > 0:
        print(f"  Discounts              {fmt(-revenue['discounts'])}")
    if revenue["refunds"] > 0:
        print(f"  Refunds                {fmt(-revenue['refunds'])}")
    print(f"  {'─'*42}")
    print(f"  Net Revenue            {fmt(revenue['net'])}")

    print(f"\n  COST OF GOODS SOLD")
    if cogs > 0:
        print(f"  Supplies / COGS        {fmt(-cogs)}")
    else:
        print(f"  Supplies / COGS        {fmt(0.0)}  (none logged)")
    print(f"  {'─'*42}")
    print(f"  Gross Profit           {fmt(gross_profit)}   ({gp_margin:.1f}%)")

    print(f"\n  OPERATING EXPENSES")
    print(f"  Payroll/Commissions    {fmt(-commission)}")

    expense_order = ["rent", "utilities", "software", "marketing",
                     "equipment", "education", "insurance", "banking", "misc"]
    for cat in expense_order:
        if cat in expenses and expenses[cat] > 0:
            label_str = cat.replace("_", " ").title()
            print(f"  {label_str:<23}{fmt(-expenses[cat])}")
    for cat, amt in expenses.items():
        if cat not in expense_order and amt > 0:
            print(f"  {cat.title():<23}{fmt(-amt)}")

    print(f"  {'─'*42}")
    print(f"  Total Operating Exp    {fmt(-total_opex)}")

    print(f"\n{'═'*w}")
    margin_label = f"({net_margin:.1f}% margin)"
    profit_label = "NET PROFIT" if net_profit >= 0 else "NET LOSS"
    print(f"  {profit_label:<23}{fmt(net_profit)}   {margin_label}")
    print(f"{'═'*w}\n")

    if net_margin < 10:
        print(f"  ⚠  Margin below 10% — review expense categories.")
    elif net_margin >= 20:
        print(f"  ✅ Healthy margin. Consider building cash reserve.")
    print()


def export_csv(months_data: list, year: int, output_dir=".tmp"):
    os.makedirs(output_dir, exist_ok=True)
    filepath = os.path.join(output_dir, f"tax_export_{year}.csv")
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "month", "gross_revenue", "discounts", "refunds", "net_revenue",
            "cogs", "gross_profit", "commissions", "rent", "utilities",
            "software", "marketing", "equipment", "insurance", "banking", "misc",
            "total_expenses", "net_profit", "net_margin_pct"
        ])
        for m in months_data:
            writer.writerow(m)
    print(f"  Tax export saved to: {filepath}")
    print(f"  Send this file to your accountant along with bank statements.")


def period_range(period: str, ref: date):
    if period == "weekly":
        start = ref - timedelta(days=ref.weekday())
        end = start + timedelta(days=6)
        label = f"Week of {start.strftime('%b %d, %Y')}"
    elif period == "ytd":
        start = ref.replace(month=1, day=1)
        end = ref
        label = f"Year to Date {ref.year}"
    else:  # monthly
        start = ref.replace(day=1)
        next_m = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
        end = min(next_m - timedelta(days=1), ref)
        label = start.strftime("%B %Y")
    return start, end, label


def main():
    parser = argparse.ArgumentParser(description="Profit & Loss report generator.")
    parser.add_argument("--monthly", action="store_true")
    parser.add_argument("--weekly", action="store_true")
    parser.add_argument("--ytd", action="store_true")
    parser.add_argument("--year", type=int, help="Full year P&L (e.g., --year 2026)")
    parser.add_argument("--month", type=str, help="Specific month YYYY-MM")
    parser.add_argument("--export", action="store_true", help="Export to CSV for tax/accountant use")
    args = parser.parse_args()

    try:
        conn = get_connection()
        cur = conn.cursor()
    except Exception as e:
        print(f"DB connection failed: {e}")
        return

    try:
        if args.year:
            # Generate all 12 months
            months_data = []
            for month_num in range(1, 13):
                start = date(args.year, month_num, 1)
                if month_num == 12:
                    end = date(args.year, 12, 31)
                else:
                    end = date(args.year, month_num + 1, 1) - timedelta(days=1)
                if end > date.today():
                    end = date.today()
                    if start > date.today():
                        break

                rev = revenue_data(cur, start, end)
                comm = commission_total(cur, start, end)
                exp = expenses_by_category(start, end)
                cogs = exp.pop("supplies", 0) + exp.pop("retail", 0)
                total_opex = comm + sum(exp.values())
                net = rev["net"] - cogs - total_opex
                margin = (net / rev["net"] * 100) if rev["net"] > 0 else 0

                label = start.strftime("%B %Y")
                print_pl(rev, comm, exp, label, start, end)

                months_data.append([
                    start.strftime("%B %Y"),
                    round(rev["gross"], 2), round(rev["discounts"], 2),
                    round(rev["refunds"], 2), round(rev["net"], 2),
                    round(cogs, 2), round(rev["net"] - cogs, 2),
                    round(comm, 2),
                    round(exp.get("rent", 0), 2),
                    round(exp.get("utilities", 0), 2),
                    round(exp.get("software", 0), 2),
                    round(exp.get("marketing", 0), 2),
                    round(exp.get("equipment", 0), 2),
                    round(exp.get("insurance", 0), 2),
                    round(exp.get("banking", 0), 2),
                    round(exp.get("misc", 0), 2),
                    round(total_opex, 2),
                    round(net, 2),
                    round(margin, 1),
                ])

            if args.export:
                export_csv(months_data, args.year)
            return

        # Single period
        if args.weekly:
            period_type = "weekly"
        elif args.ytd:
            period_type = "ytd"
        else:
            period_type = "monthly"

        if args.month:
            ref = datetime.strptime(args.month, "%Y-%m").date()
        else:
            ref = date.today()

        start, end, label = period_range(period_type, ref)
        rev = revenue_data(cur, start, end)
        comm = commission_total(cur, start, end)
        exp = expenses_by_category(start, end)
        print_pl(rev, comm, exp, label, start, end)

        if args.export:
            # Single period export
            cogs = 0
            total_opex = comm + sum(exp.values())
            net = rev["net"] - cogs - total_opex
            margin = (net / rev["net"] * 100) if rev["net"] > 0 else 0
            export_csv([[
                label, rev["gross"], rev["discounts"], rev["refunds"], rev["net"],
                cogs, rev["net"] - cogs, comm,
                exp.get("rent", 0), exp.get("utilities", 0),
                exp.get("software", 0), exp.get("marketing", 0),
                exp.get("equipment", 0), exp.get("insurance", 0),
                exp.get("banking", 0), exp.get("misc", 0),
                total_opex, net, round(margin, 1)
            ]], ref.year)

    except psycopg2.errors.UndefinedTable:
        print("\nWarning: transactions table not found.")
        print("P&L requires POS transaction data in the DB.")
        print("Expense-only P&L: run --monthly with expenses logged in .tmp/expenses.csv")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
