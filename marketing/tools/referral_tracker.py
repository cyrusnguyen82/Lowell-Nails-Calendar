"""
referral_tracker.py

Manages the referral program: generates referral codes, logs referrals,
tracks rewards owed, and produces monthly referral reports.

Usage:
    python marketing/tools/referral_tracker.py --report
    python marketing/tools/referral_tracker.py --generate-codes
    python marketing/tools/referral_tracker.py --log --referrer-id 42 --new-client-id 87
    python marketing/tools/referral_tracker.py --pending-rewards

Referral codes:
    Format: first 4 chars of last_name (uppercase) + last 4 digits of phone
    Example: Sarah Johnson, (555) 867-5309 → JOHN5309

Referral log:
    Stored in .tmp/referral_log.csv (portable, no schema change required)
    Columns: referral_date, referrer_id, referrer_name, referrer_code,
             new_client_id, new_client_name, visit_completed, reward_issued

Upgrade path:
    When ready, move referral data into a proper DB table for full automation.
"""

import os
import csv
import re
import argparse
from datetime import date
import psycopg2
from dotenv import load_dotenv

load_dotenv()

REFERRAL_LOG = ".tmp/referral_log.csv"
CODES_FILE = ".tmp/referral_codes.csv"

LOG_COLUMNS = [
    "referral_date", "referrer_id", "referrer_name", "referrer_code",
    "new_client_id", "new_client_name", "visit_completed", "reward_issued", "notes"
]
CODES_COLUMNS = ["client_id", "first_name", "last_name", "phone", "email", "referral_code"]


def get_connection():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL not set in .env")
    return psycopg2.connect(db_url)


def make_referral_code(last_name: str, phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    last4 = digits[-4:] if len(digits) >= 4 else digits.zfill(4)
    name_part = re.sub(r"[^A-Za-z]", "", last_name)[:4].upper().ljust(4, "X")
    return f"{name_part}{last4}"


def generate_all_codes(conn, output_dir=".tmp"):
    cur = conn.cursor()
    cur.execute("""
        SELECT id, first_name, last_name, phone, email
        FROM clients
        WHERE phone IS NOT NULL AND phone != ''
        ORDER BY id
    """)
    rows = cur.fetchall()
    cur.close()

    os.makedirs(output_dir, exist_ok=True)
    filepath = os.path.join(output_dir, "referral_codes.csv")
    codes = []

    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(CODES_COLUMNS)
        for row in rows:
            client_id, first, last, phone, email = row
            code = make_referral_code(last or "", phone or "")
            writer.writerow([client_id, first, last, phone, email, code])
            codes.append(code)

    print(f"\nGenerated {len(rows)} referral codes → {filepath}")
    print("Share these codes with clients via the referral email template.")
    print("See: marketing/templates/referral_outreach.md")


def log_referral(referrer_id: int, new_client_id: int, conn, notes=""):
    cur = conn.cursor()

    cur.execute("SELECT first_name, last_name, phone FROM clients WHERE id = %s", (referrer_id,))
    ref = cur.fetchone()
    if not ref:
        print(f"Referrer ID {referrer_id} not found.")
        cur.close()
        return
    referrer_name = f"{ref[0]} {ref[1]}"
    referrer_code = make_referral_code(ref[1] or "", ref[2] or "")

    cur.execute("SELECT first_name, last_name FROM clients WHERE id = %s", (new_client_id,))
    nc = cur.fetchone()
    if not nc:
        print(f"New client ID {new_client_id} not found.")
        cur.close()
        return
    new_client_name = f"{nc[0]} {nc[1]}"
    cur.close()

    os.makedirs(os.path.dirname(REFERRAL_LOG) or ".", exist_ok=True)
    file_exists = os.path.exists(REFERRAL_LOG)

    with open(REFERRAL_LOG, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=LOG_COLUMNS)
        if not file_exists:
            writer.writeheader()
        writer.writerow({
            "referral_date": date.today().isoformat(),
            "referrer_id": referrer_id,
            "referrer_name": referrer_name,
            "referrer_code": referrer_code,
            "new_client_id": new_client_id,
            "new_client_name": new_client_name,
            "visit_completed": "yes",
            "reward_issued": "no",
            "notes": notes,
        })

    print(f"\nReferral logged:")
    print(f"  Referrer:   {referrer_name} ({referrer_code}) [ID: {referrer_id}]")
    print(f"  New Client: {new_client_name} [ID: {new_client_id}]")
    print(f"  Reward:     Pending — run --pending-rewards to see all outstanding rewards")


def show_pending_rewards():
    if not os.path.exists(REFERRAL_LOG):
        print("No referral log found. Log referrals with --log first.")
        return

    reward_amount = os.getenv("REFERRAL_REWARD", "10")
    currency = os.getenv("REFERRAL_CURRENCY", "USD")

    pending = []
    with open(REFERRAL_LOG, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("reward_issued", "no").lower() == "no" and row.get("visit_completed", "no").lower() == "yes":
                pending.append(row)

    if not pending:
        print("\nNo pending rewards. All referrals have been rewarded.")
        return

    totals = {}
    for row in pending:
        name = row["referrer_name"]
        rid = row["referrer_id"]
        key = (rid, name)
        totals[key] = totals.get(key, 0) + 1

    print(f"\nPENDING REFERRAL REWARDS — {date.today()}")
    print("=" * 50)
    total_credit = 0
    for (rid, name), count in sorted(totals.items(), key=lambda x: -x[1]):
        credit = count * int(reward_amount)
        print(f"  {name:<25} [ID: {rid:>5}]  {count} referral(s)  →  ${credit} {currency} credit owed")
        total_credit += credit
    print("-" * 50)
    print(f"  Total credit to issue: ${total_credit} {currency}")
    print()
    print("Action: Apply credit to each client's account at their next POS transaction.")
    print("        After issuing, update 'reward_issued' to 'yes' in:", REFERRAL_LOG)


def show_report():
    if not os.path.exists(REFERRAL_LOG):
        print("No referral log found yet. Referrals are logged with --log.")
        return

    reward_amount = int(os.getenv("REFERRAL_REWARD", "10"))

    referrers = {}
    total_referrals = 0
    with open(REFERRAL_LOG, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rid = row["referrer_id"]
            name = row["referrer_name"]
            code = row["referrer_code"]
            if rid not in referrers:
                referrers[rid] = {"name": name, "code": code, "total": 0, "rewarded": 0, "pending": 0}
            referrers[rid]["total"] += 1
            total_referrals += 1
            if row.get("reward_issued", "no").lower() == "yes":
                referrers[rid]["rewarded"] += 1
            else:
                referrers[rid]["pending"] += 1

    print(f"\nREFERRAL PROGRAM REPORT — {date.today()}")
    print("=" * 60)
    print(f"  Total referrals logged: {total_referrals}")
    print(f"  Total revenue influence: est. ${total_referrals * reward_amount * 5} (assuming $50 avg first visit)")
    print()
    print(f"  {'Name':<25} {'Code':<10} {'Total':>6} {'Rewarded':>9} {'Pending':>8}")
    print(f"  {'-'*25} {'-'*10} {'-'*6} {'-'*9} {'-'*8}")
    for rid, data in sorted(referrers.items(), key=lambda x: -x[1]["total"]):
        print(f"  {data['name']:<25} {data['code']:<10} {data['total']:>6} {data['rewarded']:>9} {data['pending']:>8}")
    print()
    print(f"  Run --pending-rewards to see credit amounts owed.")


def main():
    parser = argparse.ArgumentParser(description="Referral program tracker.")
    parser.add_argument("--report", action="store_true", help="Show full referral program summary.")
    parser.add_argument("--generate-codes", action="store_true", help="Generate referral codes for all clients.")
    parser.add_argument("--log", action="store_true", help="Log a new referral (use with --referrer-id and --new-client-id).")
    parser.add_argument("--referrer-id", type=int, help="Client ID of the person who referred.")
    parser.add_argument("--new-client-id", type=int, help="Client ID of the newly referred client.")
    parser.add_argument("--notes", default="", help="Optional notes for the referral log.")
    parser.add_argument("--pending-rewards", action="store_true", help="Show all referrers with unrewarded referrals.")
    parser.add_argument("--output", default=".tmp", help="Output directory for CSV files (default: .tmp)")
    args = parser.parse_args()

    if args.report:
        show_report()
        return

    if args.pending_rewards:
        show_pending_rewards()
        return

    if args.generate_codes or args.log:
        try:
            conn = get_connection()
        except Exception as e:
            print(f"DB connection failed: {e}")
            return

        try:
            if args.generate_codes:
                generate_all_codes(conn, args.output)
            elif args.log:
                if not args.referrer_id or not args.new_client_id:
                    print("--log requires both --referrer-id and --new-client-id")
                    return
                log_referral(args.referrer_id, args.new_client_id, conn, args.notes)
        finally:
            conn.close()
        return

    parser.print_help()


if __name__ == "__main__":
    main()
