"""
expense_tracker.py

Log, view, and summarize business expenses from a CSV file.
No DB schema changes required — all data lives in .tmp/expenses.csv.

Usage:
    # Add an expense
    python Financial/tools/expense_tracker.py --add --amount 250 --category supplies --note "Color products"

    # Add with specific date
    python Financial/tools/expense_tracker.py --add --amount 1500 --category rent --note "June rent" --date 2026-06-01

    # Mark as recurring
    python Financial/tools/expense_tracker.py --add --amount 89 --category software --note "SendGrid" --recurring

    # View this month's summary by category
    python Financial/tools/expense_tracker.py --summary

    # View a specific month
    python Financial/tools/expense_tracker.py --summary --month 2026-04

    # List all expenses in a date range
    python Financial/tools/expense_tracker.py --list --from 2026-05-01 --to 2026-05-31

    # Show recurring expenses (monthly reminders)
    python Financial/tools/expense_tracker.py --recurring-list
"""

import os
import csv
import argparse
from datetime import date, datetime
from collections import defaultdict
from dotenv import load_dotenv

load_dotenv()

EXPENSES_FILE = ".tmp/expenses.csv"
SYMBOL = "$"
VALID_CATEGORIES = [
    "supplies", "retail", "rent", "utilities", "software",
    "marketing", "payroll", "equipment", "education",
    "insurance", "banking", "misc"
]
COLUMNS = ["id", "date", "amount", "category", "note", "recurring", "personal"]


def load_expenses():
    if not os.path.exists(EXPENSES_FILE):
        return []
    with open(EXPENSES_FILE, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return list(reader)


def next_id(expenses):
    if not expenses:
        return 1
    return max(int(e.get("id", 0)) for e in expenses) + 1


def save_expense(entry: dict):
    os.makedirs(os.path.dirname(EXPENSES_FILE) or ".", exist_ok=True)
    file_exists = os.path.exists(EXPENSES_FILE)
    with open(EXPENSES_FILE, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS)
        if not file_exists:
            writer.writeheader()
        writer.writerow(entry)


def fmt(amount):
    return f"{SYMBOL}{float(amount):,.2f}"


def add_expense(amount: float, category: str, note: str,
                expense_date: date, recurring: bool, personal: bool):
    expenses = load_expenses()
    entry = {
        "id": next_id(expenses),
        "date": expense_date.isoformat(),
        "amount": round(amount, 2),
        "category": category.lower(),
        "note": note,
        "recurring": "yes" if recurring else "no",
        "personal": "yes" if personal else "no",
    }
    save_expense(entry)
    flag = " [RECURRING]" if recurring else ""
    flag += " [PERSONAL]" if personal else ""
    print(f"\nExpense logged: {fmt(amount)} | {category} | {note}{flag}")
    print(f"Date: {expense_date}  |  ID: {entry['id']}")
    print(f"File: {EXPENSES_FILE}")


def summarize(month_str: str = None):
    expenses = load_expenses()
    if not expenses:
        print("\nNo expenses logged yet. Use --add to log your first expense.")
        return

    if month_str:
        try:
            target = datetime.strptime(month_str, "%Y-%m")
        except ValueError:
            print("Invalid month format. Use YYYY-MM (e.g., 2026-05)")
            return
        expenses = [
            e for e in expenses
            if e.get("personal", "no") != "yes"
            and e["date"].startswith(month_str)
        ]
        period_label = target.strftime("%B %Y")
    else:
        today = date.today()
        month_str = today.strftime("%Y-%m")
        expenses = [
            e for e in expenses
            if e.get("personal", "no") != "yes"
            and e["date"].startswith(month_str)
        ]
        period_label = today.strftime("%B %Y")

    if not expenses:
        print(f"\nNo expenses found for {period_label}.")
        return

    by_category = defaultdict(float)
    for e in expenses:
        by_category[e["category"]] += float(e["amount"])

    total = sum(by_category.values())
    w = 52
    print(f"\n{'='*w}")
    print(f"  EXPENSE SUMMARY — {period_label}")
    print(f"{'='*w}")
    for cat in sorted(by_category, key=lambda c: -by_category[c]):
        pct = (by_category[cat] / total) * 100
        print(f"  {cat:<15} {fmt(by_category[cat]):>10}   ({pct:.1f}%)")
    print(f"  {'-'*40}")
    print(f"  {'TOTAL':<15} {fmt(total):>10}")
    print(f"{'='*w}")
    print(f"  Entries: {len(expenses)}")
    print()


def list_expenses(from_date: date, to_date: date):
    expenses = load_expenses()
    filtered = [
        e for e in expenses
        if from_date.isoformat() <= e["date"] <= to_date.isoformat()
    ]
    if not filtered:
        print(f"\nNo expenses from {from_date} to {to_date}.")
        return

    print(f"\nEXPENSES: {from_date} to {to_date}")
    print(f"{'ID':>4}  {'Date':<12} {'Amount':>10}  {'Category':<12} {'Note'}")
    print(f"{'─'*4}  {'─'*12} {'─'*10}  {'─'*12} {'─'*30}")
    total = 0.0
    for e in sorted(filtered, key=lambda x: x["date"]):
        personal_flag = " [P]" if e.get("personal") == "yes" else ""
        print(f"{e['id']:>4}  {e['date']:<12} {fmt(e['amount']):>10}  {e['category']:<12} {e['note']}{personal_flag}")
        if e.get("personal") != "yes":
            total += float(e["amount"])
    print(f"\n  Business total: {fmt(total)}")


def show_recurring():
    expenses = load_expenses()
    recurring = [e for e in expenses if e.get("recurring") == "yes"]

    seen = {}
    for e in recurring:
        key = (e["category"], e["note"])
        if key not in seen or e["date"] > seen[key]["date"]:
            seen[key] = e

    if not seen:
        print("\nNo recurring expenses configured yet.")
        print("Use --recurring flag when adding a monthly expense.")
        return

    print("\nRECURRING MONTHLY EXPENSES")
    print(f"{'Category':<15} {'Amount':>10}  {'Note'}")
    print(f"{'─'*15} {'─'*10}  {'─'*30}")
    total = 0.0
    for (cat, note), e in sorted(seen.items()):
        print(f"{cat:<15} {fmt(e['amount']):>10}  {note}")
        total += float(e["amount"])
    print(f"\n  Monthly fixed cost: {fmt(total)}")
    print(f"  Annual fixed cost:  {fmt(total * 12)}")


def main():
    parser = argparse.ArgumentParser(description="Business expense tracker.")
    parser.add_argument("--add", action="store_true", help="Log a new expense.")
    parser.add_argument("--amount", type=float, help="Expense amount.")
    parser.add_argument("--category", choices=VALID_CATEGORIES, help="Expense category.")
    parser.add_argument("--note", default="", help="Description of the expense.")
    parser.add_argument("--date", type=str, help="Date (YYYY-MM-DD). Defaults to today.")
    parser.add_argument("--recurring", action="store_true", help="Mark as a monthly recurring expense.")
    parser.add_argument("--personal", action="store_true", help="Mark as personal (excluded from P&L).")
    parser.add_argument("--summary", action="store_true", help="Show expense summary by category.")
    parser.add_argument("--month", type=str, help="Month for summary (YYYY-MM).")
    parser.add_argument("--list", action="store_true", help="List all expenses in a date range.")
    parser.add_argument("--from", dest="from_date", type=str, help="Start date (YYYY-MM-DD).")
    parser.add_argument("--to", dest="to_date", type=str, help="End date (YYYY-MM-DD).")
    parser.add_argument("--recurring-list", action="store_true", help="Show all recurring monthly expenses.")
    args = parser.parse_args()

    if args.add:
        if not args.amount or not args.category:
            print("--add requires --amount and --category")
            return
        expense_date = date.fromisoformat(args.date) if args.date else date.today()
        add_expense(args.amount, args.category, args.note, expense_date, args.recurring, args.personal)

    elif args.summary:
        summarize(args.month)

    elif args.list:
        from_date = date.fromisoformat(args.from_date) if args.from_date else date.today().replace(day=1)
        to_date = date.fromisoformat(args.to_date) if args.to_date else date.today()
        list_expenses(from_date, to_date)

    elif args.recurring_list:
        show_recurring()

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
