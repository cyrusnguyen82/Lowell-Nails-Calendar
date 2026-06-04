"""
monthly_reactivation.py

Runs the full reactivation campaign on the 1st of every month.
Segments lapsed clients and sends appropriate email per segment.
Skips clients who have been contacted recently.

Usage:
    python Orchestration/jobs/monthly_reactivation.py
    python Orchestration/jobs/monthly_reactivation.py --dry-run
    python Orchestration/jobs/monthly_reactivation.py --segment lapsed
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
log = logging.getLogger("monthly_reactivation")

EVENT_LOG = os.path.join(ROOT, ".tmp", "event_log.csv")
REACTIVATION_COOLDOWN_DAYS = 30


def get_connection():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL not set in .env")
    return psycopg2.connect(db_url)


def recently_contacted(event_type_prefix: str = "reactivation") -> set:
    if not os.path.exists(EVENT_LOG):
        return set()
    cutoff = (date.today() - timedelta(days=REACTIVATION_COOLDOWN_DAYS)).isoformat()
    contacted = set()
    with open(EVENT_LOG, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if (row.get("event_type", "").startswith(event_type_prefix)
                    and row.get("status") == "sent"
                    and row.get("timestamp", "")[:10] >= cutoff):
                contacted.add(str(row["entity_id"]))
    return contacted


def log_event(event_type, entity_id, channel, recipient, status, note=""):
    os.makedirs(os.path.dirname(EVENT_LOG) or ".", exist_ok=True)
    file_exists = os.path.exists(EVENT_LOG)
    with open(EVENT_LOG, "a", newline="", encoding="utf-8") as f:
        cols = ["timestamp", "event_type", "entity_id", "channel", "recipient", "status", "note"]
        writer = csv.DictWriter(f, fieldnames=cols)
        if not file_exists:
            writer.writeheader()
        writer.writerow({
            "timestamp": datetime.now().isoformat(),
            "event_type": event_type,
            "entity_id": entity_id,
            "channel": channel,
            "recipient": recipient,
            "status": status,
            "note": note,
        })


SEGMENT_CONFIG = {
    "at_risk": {
        "days_min": 45, "days_max": 60,
        "event_type": "reactivation_at_risk",
        "subject": "It's been a minute, {first_name}",
        "body": (
            "Hey {first_name},\n\n"
            "We've been thinking about you — it's been a while since your last visit.\n\n"
            "No pressure at all, just wanted to say hi and let you know we're here whenever you're ready.\n\n"
            "Ready to book: {booking_link}\n\n"
            "— {business}"
        ),
    },
    "lapsed": {
        "days_min": 61, "days_max": 90,
        "event_type": "reactivation_lapsed",
        "subject": "We want you back — here's 15% off",
        "body": (
            "Hey {first_name},\n\n"
            "We noticed it's been a couple months since your last visit, and we miss having you.\n\n"
            "We want to make it easy to come back. Here's 15% off your next appointment — "
            "just mention this email when you book. Offer expires in 14 days.\n\n"
            "→ {booking_link}\n\n"
            "— {business}"
        ),
    },
    "dormant": {
        "days_min": 91, "days_max": 180,
        "event_type": "reactivation_dormant",
        "subject": "We'd love to earn your trust back",
        "body": (
            "Hey {first_name},\n\n"
            "I'll be honest — it's been a long time, and I'd rather reach out directly "
            "than pretend you haven't been missed.\n\n"
            "We're offering you 20% off your next visit — just for you, expires in 7 days.\n\n"
            "→ {booking_link}\n\n"
            "— {business}"
        ),
    },
    "cold": {
        "days_min": 181, "days_max": 9999,
        "event_type": "reactivation_cold",
        "subject": "One last note before we say goodbye",
        "body": (
            "Hey {first_name},\n\n"
            "I know it's been a very long time, and I don't want to keep showing up in your inbox "
            "if we're not the right fit anymore.\n\n"
            "So this is the last email I'll send unless you'd like to hear from us.\n\n"
            "If you do want to come back: 25% off your next visit — our best offer, no conditions.\n\n"
            "→ {booking_link}\n\n"
            "If you'd rather we stop emailing, just ignore this — we won't reach out again.\n\n"
            "— {business}"
        ),
    },
}


def fetch_segment(cur, days_min: int, days_max: int) -> list:
    today = date.today()
    from_date = today - timedelta(days=days_max)
    to_date = today - timedelta(days=days_min)
    cur.execute("""
        SELECT
            c.id,
            c.first_name,
            c.last_name,
            c.email,
            c.phone,
            MAX(a.start_time)::date AS last_visit,
            COALESCE(SUM(tx.total), 0) AS lifetime_value
        FROM clients c
        JOIN appointments a ON a.client_id = c.id
        LEFT JOIN transactions tx ON tx.client_id = c.id
            AND tx.status IN ('completed', 'paid', 'done')
        WHERE a.status IN ('completed', 'done', 'confirmed')
          AND c.email IS NOT NULL AND c.email != ''
        GROUP BY c.id, c.first_name, c.last_name, c.email, c.phone
        HAVING MAX(a.start_time)::date BETWEEN %s AND %s
        ORDER BY lifetime_value DESC
    """, (from_date, to_date))
    return cur.fetchall()


def send_segment(clients: list, config: dict, dry_run: bool, contacted: set) -> int:
    from Orchestration.tools.integrations.sendgrid_client import send_email_to_client
    from Orchestration.tools.integrations.twilio_client import send_sms_to_client

    business = os.getenv("MARKETING_FROM_NAME", "us")
    booking_link = os.getenv("VITE_API_URL", "")
    sent = 0

    for row in clients:
        client_id, first, last, email, phone, last_visit, ltv = row
        if str(client_id) in contacted:
            continue

        subject = config["subject"].format(first_name=first)
        body = config["body"].format(
            first_name=first,
            business=business,
            booking_link=booking_link,
        )
        event_type = config["event_type"]

        if dry_run:
            print(f"  [DRY RUN] {event_type} → {first} {last} ({email})")
            log_event(event_type, client_id, "email", email, "dry_run")
            sent += 1
            continue

        result = send_email_to_client(first, email, subject, body)
        status = "sent" if result["success"] else "failed"
        log_event(event_type, client_id, "email", email, status, result.get("error", ""))
        if status == "sent":
            sent += 1

        # Personal SMS for high-LTV dormant clients
        if config["event_type"] == "reactivation_dormant" and float(ltv) >= 300 and phone:
            sms = (
                f"Hey {first}, it's {business}. It's been a while and I wanted to personally reach out — "
                f"I'd love to have you back. 20% off your next visit. Want me to grab you a spot? "
                f"Just reply here."
            )
            if not dry_run:
                sms_result = send_sms_to_client(first, phone, sms)
                log_event(f"{event_type}_sms", client_id, "sms", phone,
                          "sent" if sms_result["success"] else "failed")

    return sent


def run(dry_run: bool = False, segment: str = None) -> int:
    try:
        conn = get_connection()
        cur = conn.cursor()
    except Exception as e:
        log.error(f"DB connection failed: {e}")
        return 0

    contacted = recently_contacted("reactivation")
    total_sent = 0
    segments_to_run = [segment] if segment else list(SEGMENT_CONFIG.keys())

    for seg_name in segments_to_run:
        config = SEGMENT_CONFIG[seg_name]
        clients = fetch_segment(cur, config["days_min"], config["days_max"])
        eligible = [c for c in clients if str(c[0]) not in contacted]

        log.info(f"[reactivation] {seg_name}: {len(eligible)} eligible clients")
        sent = send_segment(eligible, config, dry_run, contacted)
        total_sent += sent
        log.info(f"[reactivation] {seg_name}: {sent} sent")

    cur.close()
    conn.close()

    log.info(f"[reactivation] Total sent: {total_sent}")
    return total_sent


def main():
    parser = argparse.ArgumentParser(description="Monthly reactivation campaign.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--segment", choices=list(SEGMENT_CONFIG.keys()),
                        help="Run a single segment only.")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    count = run(dry_run=args.dry_run, segment=args.segment)
    print(f"\nReactivation emails sent: {count}")


if __name__ == "__main__":
    main()
