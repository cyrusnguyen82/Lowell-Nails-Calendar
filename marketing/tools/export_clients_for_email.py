"""
export_clients_for_email.py

Exports segmented client lists from the DB for upload to email platforms (SendGrid, Mailchimp, etc.).

Usage:
    python marketing/tools/export_clients_for_email.py
    python marketing/tools/export_clients_for_email.py --segment new_leads
    python marketing/tools/export_clients_for_email.py --segment loyal
    python marketing/tools/export_clients_for_email.py --segment active
    python marketing/tools/export_clients_for_email.py --segment all
    python marketing/tools/export_clients_for_email.py --validate   # flag bad/missing emails

Segments:
    new_leads   : clients with an email but 0 completed appointments (never visited)
    active      : clients with 1+ visit in the past 90 days
    loyal       : clients with 2+ visits in the past 90 days (referral + broadcast targets)
    all         : all clients with a valid email address

Output format matches SendGrid contact import CSV spec.
"""

import os
import csv
import re
import argparse
from datetime import date, timedelta
import psycopg2
from dotenv import load_dotenv

load_dotenv()

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")

SEGMENTS = {
    "new_leads": "Clients with email but no completed appointments",
    "active":    "Clients with 1+ visit in the past 90 days",
    "loyal":     "Clients with 2+ visits in the past 90 days",
    "all":       "All clients with a valid email address",
}


def get_connection():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL not set in .env")
    return psycopg2.connect(db_url)


def is_valid_email(email: str) -> bool:
    return bool(email and EMAIL_REGEX.match(email.strip()))


def fetch_new_leads(conn):
    query = """
        SELECT c.id, c.first_name, c.last_name, c.email, c.phone
        FROM clients c
        WHERE c.email IS NOT NULL AND c.email != ''
          AND NOT EXISTS (
            SELECT 1 FROM appointments a
            WHERE a.client_id = c.id
              AND a.status IN ('completed', 'confirmed', 'done')
          )
        ORDER BY c.id
    """
    cur = conn.cursor()
    cur.execute(query)
    rows = cur.fetchall()
    cur.close()
    return rows


def fetch_active(conn, days=90, min_visits=1):
    cutoff = date.today() - timedelta(days=days)
    query = """
        SELECT
            c.id,
            c.first_name,
            c.last_name,
            c.email,
            c.phone,
            COUNT(a.id) AS visit_count,
            MAX(a.start_time)::date AS last_visit
        FROM clients c
        JOIN appointments a ON a.client_id = c.id
        WHERE c.email IS NOT NULL AND c.email != ''
          AND a.status IN ('completed', 'confirmed', 'done')
          AND a.start_time::date >= %s
        GROUP BY c.id, c.first_name, c.last_name, c.email, c.phone
        HAVING COUNT(a.id) >= %s
        ORDER BY MAX(a.start_time) DESC
    """
    cur = conn.cursor()
    cur.execute(query, (cutoff, min_visits))
    rows = cur.fetchall()
    cur.close()
    return rows


def fetch_all(conn):
    query = """
        SELECT c.id, c.first_name, c.last_name, c.email, c.phone
        FROM clients c
        WHERE c.email IS NOT NULL AND c.email != ''
        ORDER BY c.id
    """
    cur = conn.cursor()
    cur.execute(query)
    rows = cur.fetchall()
    cur.close()
    return rows


def validate_emails(rows, id_col=0, email_col=3):
    valid, invalid = [], []
    for row in rows:
        if is_valid_email(str(row[email_col])):
            valid.append(row)
        else:
            invalid.append(row)
    return valid, invalid


def write_csv(rows, filepath, columns):
    os.makedirs(os.path.dirname(filepath) or ".", exist_ok=True)
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(columns)
        writer.writerows(rows)
    print(f"  Wrote {len(rows)} rows → {filepath}")


def export_segment(conn, segment: str, output_dir: str, validate: bool):
    today = date.today()
    output_path = os.path.join(output_dir, f"email_{segment}_{today}.csv")

    if segment == "new_leads":
        rows = fetch_new_leads(conn)
        columns = ["id", "first_name", "last_name", "email", "phone"]
    elif segment == "active":
        rows = fetch_active(conn, days=90, min_visits=1)
        columns = ["id", "first_name", "last_name", "email", "phone", "visit_count", "last_visit"]
    elif segment == "loyal":
        rows = fetch_active(conn, days=90, min_visits=2)
        columns = ["id", "first_name", "last_name", "email", "phone", "visit_count", "last_visit"]
    elif segment == "all":
        rows = fetch_all(conn)
        columns = ["id", "first_name", "last_name", "email", "phone"]
    else:
        print(f"Unknown segment: {segment}")
        return

    if validate:
        valid, invalid = validate_emails(rows, email_col=3)
        print(f"  Valid emails: {len(valid)}  |  Invalid/missing: {len(invalid)}")
        if invalid:
            bad_path = os.path.join(output_dir, f"email_{segment}_invalid_{today}.csv")
            write_csv(invalid, bad_path, columns)
            print(f"  Invalid emails saved for review → {bad_path}")
        rows = valid

    write_csv(rows, output_path, columns)
    print(f"  [{segment.upper()}] {len(rows)} clients exported.")
    print(f"  Description: {SEGMENTS.get(segment, '')}")


def export_all_segments(conn, output_dir: str, validate: bool):
    print(f"\nExporting all email segments — {date.today()}")
    print("=" * 50)
    for segment in SEGMENTS:
        export_segment(conn, segment, output_dir, validate)
        print()
    print(f"All files saved to: {output_dir}/")
    print("Next step: upload each CSV to SendGrid under the matching contact list.")
    print("See: marketing/workflows/02_email_nurture.md for sequence setup.")


def main():
    parser = argparse.ArgumentParser(description="Export segmented client email lists.")
    parser.add_argument("--segment", choices=list(SEGMENTS.keys()), help="Export a single segment.")
    parser.add_argument("--output", default=".tmp", help="Output directory (default: .tmp)")
    parser.add_argument("--validate", action="store_true", help="Flag and separate invalid email addresses.")
    args = parser.parse_args()

    try:
        conn = get_connection()
    except Exception as e:
        print(f"DB connection failed: {e}")
        return

    try:
        if args.segment:
            print(f"\nExporting segment: {args.segment}")
            export_segment(conn, args.segment, args.output, args.validate)
        else:
            export_all_segments(conn, args.output, args.validate)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
