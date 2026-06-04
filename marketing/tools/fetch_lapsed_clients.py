"""
fetch_lapsed_clients.py

Segments clients by inactivity window based on their last appointment date.
Outputs four CSVs for use in reactivation campaigns and review request workflows.

Usage:
    python marketing/tools/fetch_lapsed_clients.py
    python marketing/tools/fetch_lapsed_clients.py --days 1       # yesterday's appointments only
    python marketing/tools/fetch_lapsed_clients.py --segment lapsed
    python marketing/tools/fetch_lapsed_clients.py --output .tmp/lapsed.csv

Segments:
    at_risk   : 45-60 days inactive
    lapsed    : 61-90 days inactive
    dormant   : 91-180 days inactive
    cold      : 180+ days inactive
"""

import os
import csv
import argparse
from datetime import date, timedelta
import psycopg2
from dotenv import load_dotenv

load_dotenv()

SEGMENTS = {
    "at_risk":  (45,  60),
    "lapsed":   (61,  90),
    "dormant":  (91,  180),
    "cold":     (181, 9999),
}


def get_connection():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL not set in .env")
    return psycopg2.connect(db_url)


def fetch_by_days(conn, days_ago: int):
    """Fetch clients whose last appointment was exactly N days ago (for review requests)."""
    target_date = date.today() - timedelta(days=days_ago)
    query = """
        SELECT DISTINCT ON (c.id)
            c.id,
            c.first_name,
            c.last_name,
            c.phone,
            c.email,
            MAX(a.start_time)::date AS last_visit
        FROM clients c
        JOIN appointments a ON a.client_id = c.id
        WHERE a.start_time::date = %s
          AND a.status IN ('completed', 'confirmed', 'done')
        GROUP BY c.id, c.first_name, c.last_name, c.phone, c.email
        ORDER BY c.id
    """
    cur = conn.cursor()
    cur.execute(query, (target_date,))
    rows = cur.fetchall()
    cur.close()
    return rows


def fetch_segment(conn, min_days: int, max_days: int):
    """Fetch clients whose last appointment falls within the inactivity window."""
    today = date.today()
    from_date = today - timedelta(days=max_days)
    to_date = today - timedelta(days=min_days)

    query = """
        SELECT
            c.id,
            c.first_name,
            c.last_name,
            c.phone,
            c.email,
            MAX(a.start_time)::date AS last_visit,
            COUNT(a.id) AS total_visits
        FROM clients c
        JOIN appointments a ON a.client_id = c.id
        WHERE a.status IN ('completed', 'confirmed', 'done')
        GROUP BY c.id, c.first_name, c.last_name, c.phone, c.email
        HAVING MAX(a.start_time)::date BETWEEN %s AND %s
        ORDER BY MAX(a.start_time) ASC
    """
    cur = conn.cursor()
    cur.execute(query, (from_date, to_date))
    rows = cur.fetchall()
    cur.close()
    return rows


def write_csv(rows, filepath, columns):
    os.makedirs(os.path.dirname(filepath) or ".", exist_ok=True)
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(columns)
        writer.writerows(rows)
    print(f"  Wrote {len(rows)} rows → {filepath}")


def run_all_segments(conn, output_dir=".tmp"):
    print(f"\nRunning all reactivation segments — {date.today()}")
    print("=" * 50)
    total = 0
    for name, (min_d, max_d) in SEGMENTS.items():
        rows = fetch_segment(conn, min_d, max_d)
        filepath = os.path.join(output_dir, f"segment_{name}.csv")
        write_csv(
            rows, filepath,
            ["id", "first_name", "last_name", "phone", "email", "last_visit", "total_visits"]
        )
        total += len(rows)
        print(f"  [{name.upper():<8}] {len(rows):>4} clients  ({min_d}-{max_d} days inactive)")
    print("-" * 50)
    print(f"  Total lapsed clients: {total}")
    print(f"\nFiles saved to: {output_dir}/")
    print("Next step: upload each CSV to your email platform (SendGrid) into the matching list.")
    print("See: marketing/workflows/05_reactivation_campaign.md")


def run_days_mode(conn, days, output_dir=".tmp"):
    print(f"\nFetching clients with appointments {days} day(s) ago — {date.today()}")
    rows = fetch_by_days(conn, days)
    filepath = os.path.join(output_dir, f"review_requests_{date.today()}.csv")
    write_csv(
        rows, filepath,
        ["id", "first_name", "last_name", "phone", "email", "last_visit"]
    )
    print(f"  {len(rows)} clients eligible for review request.")
    print("Next step: send SMS or email from templates/review_request_templates.md")


def run_single_segment(conn, segment_name, output_dir=".tmp"):
    if segment_name not in SEGMENTS:
        print(f"Unknown segment '{segment_name}'. Choose from: {', '.join(SEGMENTS)}")
        return
    min_d, max_d = SEGMENTS[segment_name]
    rows = fetch_segment(conn, min_d, max_d)
    filepath = os.path.join(output_dir, f"segment_{segment_name}.csv")
    write_csv(
        rows, filepath,
        ["id", "first_name", "last_name", "phone", "email", "last_visit", "total_visits"]
    )
    print(f"  {len(rows)} {segment_name} clients exported.")


def main():
    parser = argparse.ArgumentParser(description="Fetch lapsed clients for reactivation campaigns.")
    parser.add_argument("--days", type=int, help="Fetch clients with an appointment N days ago (for review requests).")
    parser.add_argument("--segment", choices=list(SEGMENTS.keys()), help="Run a single segment only.")
    parser.add_argument("--output", default=".tmp", help="Output directory (default: .tmp)")
    args = parser.parse_args()

    try:
        conn = get_connection()
    except Exception as e:
        print(f"DB connection failed: {e}")
        return

    try:
        if args.days is not None:
            run_days_mode(conn, args.days, args.output)
        elif args.segment:
            run_single_segment(conn, args.segment, args.output)
        else:
            run_all_segments(conn, args.output)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
