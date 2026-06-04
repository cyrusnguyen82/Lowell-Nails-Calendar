"""
daily_review_requests.py

Finds clients with completed appointments today (or a specified date),
then sends review request SMS or email to those who haven't been asked
in the past 90 days.

Called automatically by the scheduler at 6pm daily.
Can also be triggered immediately via event_listener when an appointment
status changes to 'completed'.

Usage:
    python Orchestration/jobs/daily_review_requests.py
    python Orchestration/jobs/daily_review_requests.py --dry-run
    python Orchestration/jobs/daily_review_requests.py --date 2026-05-15
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

log = logging.getLogger("daily_review_requests")

EVENT_LOG = os.path.join(ROOT, ".tmp", "event_log.csv")
REVIEW_COOLDOWN_DAYS = 90


def get_connection():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL not set in .env")
    return psycopg2.connect(db_url)


def load_recently_asked() -> set:
    """Client IDs who received a review request in the past 90 days."""
    if not os.path.exists(EVENT_LOG):
        return set()
    cutoff = (date.today() - timedelta(days=REVIEW_COOLDOWN_DAYS)).isoformat()
    asked = set()
    with open(EVENT_LOG, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if (row.get("event_type") == "review_request"
                    and row.get("status") == "sent"
                    and row.get("timestamp", "")[:10] >= cutoff):
                asked.add(str(row["entity_id"]))
    return asked


def fetch_completed_clients(cur, target_date: date) -> list:
    cur.execute("""
        SELECT DISTINCT ON (c.id)
            c.id,
            c.first_name,
            c.last_name,
            c.phone,
            c.email,
            c.notes
        FROM appointments a
        JOIN clients c ON c.id = a.client_id
        WHERE a.status IN ('completed', 'done')
          AND a.start_time::date = %s
        ORDER BY c.id
    """, (target_date,))
    return cur.fetchall()


def log_event(client_id, channel: str, recipient: str, status: str, note: str = ""):
    os.makedirs(os.path.dirname(EVENT_LOG) or ".", exist_ok=True)
    file_exists = os.path.exists(EVENT_LOG)
    from datetime import datetime
    with open(EVENT_LOG, "a", newline="", encoding="utf-8") as f:
        cols = ["timestamp", "event_type", "entity_id", "channel", "recipient", "status", "note"]
        writer = csv.DictWriter(f, fieldnames=cols)
        if not file_exists:
            writer.writeheader()
        writer.writerow({
            "timestamp": datetime.now().isoformat(),
            "event_type": "review_request",
            "entity_id": client_id,
            "channel": channel,
            "recipient": recipient,
            "status": status,
            "note": note,
        })


def run(dry_run: bool = False, target_date: date = None) -> int:
    if target_date is None:
        target_date = date.today()

    from Orchestration.tools.integrations.twilio_client import send_sms_to_client
    from Orchestration.tools.integrations.sendgrid_client import send_email_to_client

    review_link = os.getenv("REVIEW_LINK", "")
    business = os.getenv("MARKETING_FROM_NAME", "us")
    sms_template = (
        f"Hey {{first_name}}, it's {business}! So glad you came in today. "
        f"If you have a quick second, a Google review would mean the world to us: "
        f"{review_link}"
    )
    email_subject = "Would you do us a quick favor?"

    try:
        conn = get_connection()
        cur = conn.cursor()
    except Exception as e:
        log.error(f"DB connection failed: {e}")
        return 0

    recently_asked = load_recently_asked()
    clients = fetch_completed_clients(cur, target_date)
    cur.close()
    conn.close()

    sent_count = 0
    skipped_count = 0

    for row in clients:
        client_id, first, last, phone, email, notes = row
        client_id_str = str(client_id)

        if client_id_str in recently_asked:
            log.info(f"[review_request] Skipping {first} {last} — asked in last {REVIEW_COOLDOWN_DAYS} days")
            skipped_count += 1
            continue

        if notes and any(w in (notes or "").lower() for w in ["bad", "complaint", "issue", "refund", "problem"]):
            log_event(client_id, "skipped", "", "skipped", "Negative notes")
            skipped_count += 1
            continue

        if phone:
            if not dry_run:
                result = send_sms_to_client(first, phone, sms_template)
                status = "sent" if result["success"] else "failed"
                note = result.get("error", "")
            else:
                status, note = "dry_run", f"Would SMS {first} {last} at {phone}"
                print(f"  [DRY RUN] SMS → {first} {last} ({phone})")
            log_event(client_id, "sms", phone, status, note)
            if status == "sent":
                sent_count += 1
        elif email:
            body = (
                f"Hey {first},\n\nIt was great having you in today.\n\n"
                f"If you enjoyed your experience, would you mind leaving us a Google review? "
                f"It takes less than a minute: {review_link}\n\nThank you so much.\n\n— {business}"
            )
            if not dry_run:
                result = send_email_to_client(first, email, email_subject, body)
                status = "sent" if result["success"] else "failed"
                note = result.get("error", "")
            else:
                status, note = "dry_run", f"Would email {first} {last} at {email}"
                print(f"  [DRY RUN] Email → {first} {last} ({email})")
            log_event(client_id, "email", email, status, note)
            if status == "sent":
                sent_count += 1
        else:
            skipped_count += 1

    log.info(f"[review_requests] Date: {target_date} | Sent: {sent_count} | Skipped: {skipped_count}")
    return sent_count


def main():
    parser = argparse.ArgumentParser(description="Daily review request sender.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--date", type=str, help="Target date YYYY-MM-DD (default: today)")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    target = date.fromisoformat(args.date) if args.date else date.today()
    count = run(dry_run=args.dry_run, target_date=target)
    print(f"\nReview requests sent: {count}")


if __name__ == "__main__":
    main()
