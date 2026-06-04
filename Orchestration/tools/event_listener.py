"""
event_listener.py

Polls the DB every 5 minutes for trigger conditions and fires automated actions.
Runs in a background thread alongside the scheduler.

Triggers monitored:
  - Appointment completed (new since last poll) → queue review request
  - Client crosses 45-day inactivity threshold → at-risk email
  - Client crosses 90-day inactivity threshold → dormant win-back email
  - Referral completed with reward pending → notify referrer

All fired events are deduplicated against .tmp/event_log.csv to prevent
double-sending across restarts.
"""

import os
import csv
import time
import logging
import threading
from datetime import date, datetime, timedelta
import psycopg2
from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger("event_listener")

EVENT_LOG = ".tmp/event_log.csv"
REFERRAL_LOG = ".tmp/referral_log.csv"
POLL_INTERVAL_SECONDS = int(os.getenv("EVENT_POLL_INTERVAL", 300))  # 5 min default

EVENT_LOG_COLUMNS = [
    "timestamp", "event_type", "entity_id", "channel",
    "recipient", "status", "note"
]


def get_connection():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL not set in .env")
    return psycopg2.connect(db_url)


# ─── Event Log Helpers ────────────────────────────────────────────────────────

def load_fired_events() -> set:
    """Return set of (event_type, entity_id) already processed."""
    fired = set()
    if not os.path.exists(EVENT_LOG):
        return fired
    with open(EVENT_LOG, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("status") not in ("failed",):
                fired.add((row["event_type"], str(row["entity_id"])))
    return fired


def log_event(event_type: str, entity_id, channel: str, recipient: str,
              status: str, note: str = ""):
    os.makedirs(os.path.dirname(EVENT_LOG) or ".", exist_ok=True)
    file_exists = os.path.exists(EVENT_LOG)
    with open(EVENT_LOG, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=EVENT_LOG_COLUMNS)
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


# ─── Trigger Checks ───────────────────────────────────────────────────────────

def check_completed_appointments(cur, fired: set) -> list:
    """Find appointments completed today that haven't had a review request sent."""
    today = date.today()
    # Look at appointments completed in the last 24 hours
    cur.execute("""
        SELECT
            a.id AS appt_id,
            c.id AS client_id,
            c.first_name,
            c.phone,
            c.email,
            c.notes
        FROM appointments a
        JOIN clients c ON c.id = a.client_id
        WHERE a.status IN ('completed', 'done')
          AND a.updated_at::date = %s
          AND c.phone IS NOT NULL
    """, (today,))
    rows = cur.fetchall()

    pending = []
    for appt_id, client_id, first, phone, email, notes in rows:
        key = ("review_request", str(client_id))
        if key in fired:
            continue
        # Skip if notes flag a bad experience
        if notes and any(word in (notes or "").lower() for word in ["bad", "complaint", "issue", "refund"]):
            log_event("review_request", client_id, "skipped", phone or email or "",
                      "skipped", "Negative notes — skipping review ask")
            continue
        pending.append({
            "appt_id": appt_id,
            "client_id": client_id,
            "first_name": first,
            "phone": phone,
            "email": email,
        })
    return pending


def check_lapse_thresholds(cur, fired: set) -> dict:
    """Find clients who crossed the 45-day or 90-day inactivity threshold today."""
    today = date.today()
    results = {"at_risk": [], "dormant": []}

    for days, label in [(45, "at_risk"), (90, "dormant")]:
        threshold_date = today - timedelta(days=days)
        cur.execute("""
            SELECT
                c.id,
                c.first_name,
                c.email,
                c.phone,
                MAX(a.start_time)::date AS last_visit
            FROM clients c
            JOIN appointments a ON a.client_id = c.id
            WHERE a.status IN ('completed', 'done', 'confirmed')
            GROUP BY c.id, c.first_name, c.email, c.phone
            HAVING MAX(a.start_time)::date = %s
              AND c.email IS NOT NULL
        """, (threshold_date,))
        rows = cur.fetchall()
        for client_id, first, email, phone, last_visit in rows:
            event_type = f"reactivation_{days}"
            key = (event_type, str(client_id))
            if key not in fired:
                results[label].append({
                    "client_id": client_id,
                    "first_name": first,
                    "email": email,
                    "phone": phone,
                    "last_visit": last_visit,
                })
    return results


def check_pending_referral_rewards(fired: set) -> list:
    """Find referrers whose reward hasn't been logged yet."""
    if not os.path.exists(REFERRAL_LOG):
        return []
    pending = []
    with open(REFERRAL_LOG, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if (row.get("visit_completed", "no") == "yes"
                    and row.get("reward_issued", "no") == "no"):
                key = ("referral_reward_notify", row["referrer_id"])
                if key not in fired:
                    pending.append(row)
    return pending


# ─── Action Dispatchers ───────────────────────────────────────────────────────

def dispatch_review_request(client: dict, dry_run: bool = False):
    from Orchestration.tools.integrations.twilio_client import send_sms_to_client
    from Orchestration.tools.integrations.sendgrid_client import send_email_to_client

    review_link = os.getenv("REVIEW_LINK", "")
    business = os.getenv("MARKETING_FROM_NAME", "us")

    sms_template = (
        f"Hey {{{{first_name}}}}, it's {business}! So glad you came in today. "
        f"If you have a quick second, a Google review would mean the world to us: "
        f"{review_link}"
    )

    if client.get("phone"):
        if not dry_run:
            result = send_sms_to_client(client["first_name"], client["phone"], sms_template)
            status = "sent" if result["success"] else "failed"
            note = result.get("error", "")
        else:
            status, note = "dry_run", ""
        log_event("review_request", client["client_id"], "sms",
                  client["phone"], status, note)
        log.info(f"[review_request] SMS → {client['first_name']} ({client['phone']}) — {status}")

    elif client.get("email"):
        subject = "Would you do us a quick favor?"
        body = (
            f"Hey {client['first_name']},\n\n"
            f"It was great having you in today.\n\n"
            f"If you enjoyed your experience, would you mind leaving us a Google review? "
            f"It takes less than a minute: {review_link}\n\n"
            f"Thank you so much.\n\n— {business}"
        )
        if not dry_run:
            result = send_email_to_client(client["first_name"], client["email"], subject, body)
            status = "sent" if result["success"] else "failed"
            note = result.get("error", "")
        else:
            status, note = "dry_run", ""
        log_event("review_request", client["client_id"], "email",
                  client["email"], status, note)
        log.info(f"[review_request] Email → {client['first_name']} ({client['email']}) — {status}")


def dispatch_reactivation(client: dict, days: int, dry_run: bool = False):
    from Orchestration.tools.integrations.sendgrid_client import send_email_to_client

    business = os.getenv("MARKETING_FROM_NAME", "us")
    booking_link = os.getenv("VITE_API_URL", "")
    event_type = f"reactivation_{days}"

    if days == 45:
        subject = f"It's been a minute, {client['first_name']}"
        body = (
            f"Hey {client['first_name']},\n\n"
            f"We've been thinking about you — it's been a while since your last visit.\n\n"
            f"No pressure at all, just wanted to say hi and let you know we're here when you're ready.\n\n"
            f"Ready to book: {booking_link}\n\n"
            f"— {business}"
        )
    else:
        subject = f"We'd love to earn your trust back, {client['first_name']}"
        body = (
            f"Hey {client['first_name']},\n\n"
            f"It's been a while, and I'd rather reach out directly than pretend you haven't been missed.\n\n"
            f"We're offering you 20% off your next visit — just for you, expires in 7 days.\n\n"
            f"→ {booking_link}\n\n"
            f"— {business}"
        )

    if client.get("email"):
        if not dry_run:
            result = send_email_to_client(client["first_name"], client["email"], subject, body)
            status = "sent" if result["success"] else "failed"
            note = result.get("error", "")
        else:
            status, note = "dry_run", ""
        log_event(event_type, client["client_id"], "email",
                  client["email"], status, note)
        log.info(f"[{event_type}] Email → {client['first_name']} — {status}")


def dispatch_referral_reward_notify(referral: dict, dry_run: bool = False):
    from Orchestration.tools.integrations.sendgrid_client import send_email

    reward = os.getenv("REFERRAL_REWARD", "10")
    business = os.getenv("MARKETING_FROM_NAME", "us")
    booking_link = os.getenv("VITE_API_URL", "")

    # We don't have referrer email in the log — would need a DB lookup
    # For now, notify owner to manually issue the reward
    from Orchestration.tools.integrations.sendgrid_client import send_owner_email
    owner_email = os.getenv("OWNER_EMAIL", "")
    if not owner_email:
        return

    subject = f"Referral Reward Ready — {referral['referrer_name']}"
    body = (
        f"A referral reward is ready to issue.\n\n"
        f"Referrer: {referral['referrer_name']} (ID: {referral['referrer_id']})\n"
        f"New client: {referral['new_client_name']}\n"
        f"Reward: ${reward} credit\n\n"
        f"Apply this credit at their next POS transaction.\n"
        f"Then update reward_issued=yes in: .tmp/referral_log.csv"
    )

    if not dry_run:
        result = send_owner_email(subject, body)
        status = "sent" if result["success"] else "failed"
        note = result.get("error", "")
    else:
        status, note = "dry_run", ""

    log_event("referral_reward_notify", referral["referrer_id"], "email",
              owner_email, status, note)
    log.info(f"[referral_reward] Owner notified for {referral['referrer_name']} — {status}")


# ─── Main Poll Loop ───────────────────────────────────────────────────────────

def run_poll(dry_run: bool = False):
    """Run one poll cycle — check all triggers and fire actions."""
    log.info("[event_listener] Poll cycle starting...")

    try:
        conn = get_connection()
        cur = conn.cursor()
    except Exception as e:
        log.error(f"[event_listener] DB connection failed: {e}")
        return

    try:
        fired = load_fired_events()

        # 1. Review requests
        if os.getenv("DISABLE_REVIEW_REQUESTS", "").lower() != "true":
            pending_reviews = check_completed_appointments(cur, fired)
            for client in pending_reviews:
                dispatch_review_request(client, dry_run=dry_run)

        # 2. Lapse thresholds
        if os.getenv("DISABLE_REACTIVATION", "").lower() != "true":
            lapsed = check_lapse_thresholds(cur, fired)
            for client in lapsed["at_risk"]:
                dispatch_reactivation(client, 45, dry_run=dry_run)
            for client in lapsed["dormant"]:
                dispatch_reactivation(client, 90, dry_run=dry_run)

        # 3. Referral rewards
        pending_rewards = check_pending_referral_rewards(fired)
        for referral in pending_rewards:
            dispatch_referral_reward_notify(referral, dry_run=dry_run)

        total = len(pending_reviews) + len(lapsed["at_risk"]) + len(lapsed["dormant"]) + len(pending_rewards)
        log.info(f"[event_listener] Poll complete — {total} action(s) taken")

    except Exception as e:
        log.error(f"[event_listener] Poll error: {e}")
    finally:
        cur.close()
        conn.close()


def run_loop(dry_run: bool = False):
    """Continuous polling loop — runs in a background thread."""
    log.info(f"[event_listener] Started. Polling every {POLL_INTERVAL_SECONDS}s.")
    while True:
        run_poll(dry_run=dry_run)
        time.sleep(POLL_INTERVAL_SECONDS)


def start_background(dry_run: bool = False) -> threading.Thread:
    """Launch the event listener in a daemon thread."""
    t = threading.Thread(target=run_loop, args=(dry_run,), daemon=True, name="EventListener")
    t.start()
    return t


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Event listener — run one poll cycle.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--loop", action="store_true", help="Run continuously.")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    if args.loop:
        run_loop(dry_run=args.dry_run)
    else:
        run_poll(dry_run=args.dry_run)
