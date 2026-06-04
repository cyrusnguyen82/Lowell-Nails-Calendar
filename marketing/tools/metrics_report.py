"""
metrics_report.py

Pulls the 8 core marketing KPIs from the DB and prints a formatted dashboard.
Appends weekly snapshots to .tmp/metrics_log.csv for trend tracking.

Usage:
    python marketing/tools/metrics_report.py
    python marketing/tools/metrics_report.py --weekly
    python marketing/tools/metrics_report.py --monthly
    python marketing/tools/metrics_report.py --kpi new_clients
    python marketing/tools/metrics_report.py --kpi retention
    python marketing/tools/metrics_report.py --kpi atv
    python marketing/tools/metrics_report.py --kpi ltv
    python marketing/tools/metrics_report.py --kpi conversion
    python marketing/tools/metrics_report.py --kpi churn

KPIs:
    new_clients : First-time clients in period
    retention   : % of bookings from returning clients
    atv         : Average transaction value
    ltv         : Average client lifetime value
    conversion  : % of bookings that became paid transactions
    churn       : % of period clients who did not return in the following equivalent period
"""

import os
import csv
import argparse
from datetime import date, timedelta
import psycopg2
from dotenv import load_dotenv

load_dotenv()

METRICS_LOG = ".tmp/metrics_log.csv"
LOG_COLUMNS = [
    "snapshot_date", "period", "period_start", "period_end",
    "new_clients", "returning_clients", "retention_pct",
    "avg_transaction_value", "avg_lifetime_value",
    "total_bookings", "completed_bookings", "conversion_pct",
    "churn_pct"
]


def get_connection():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL not set in .env")
    return psycopg2.connect(db_url)


def date_range(period: str):
    today = date.today()
    if period == "weekly":
        return today - timedelta(days=7), today
    elif period == "monthly":
        # Current calendar month
        start = today.replace(day=1)
        return start, today
    else:
        return today - timedelta(days=30), today


def kpi_new_clients(cur, start, end):
    cur.execute("""
        SELECT COUNT(DISTINCT c.id)
        FROM clients c
        JOIN appointments a ON a.client_id = c.id
        WHERE a.status IN ('completed', 'confirmed', 'done')
          AND a.start_time::date BETWEEN %s AND %s
          AND NOT EXISTS (
            SELECT 1 FROM appointments a2
            WHERE a2.client_id = c.id
              AND a2.status IN ('completed', 'confirmed', 'done')
              AND a2.start_time::date < %s
          )
    """, (start, end, start))
    return cur.fetchone()[0] or 0


def kpi_retention(cur, start, end):
    cur.execute("""
        SELECT
            COUNT(DISTINCT a.client_id) AS total_booking_clients,
            COUNT(DISTINCT CASE
                WHEN EXISTS (
                    SELECT 1 FROM appointments prev
                    WHERE prev.client_id = a.client_id
                      AND prev.status IN ('completed', 'confirmed', 'done')
                      AND prev.start_time::date < %s
                ) THEN a.client_id END
            ) AS returning_clients
        FROM appointments a
        WHERE a.status IN ('completed', 'confirmed', 'done')
          AND a.start_time::date BETWEEN %s AND %s
    """, (start, start, end))
    row = cur.fetchone()
    total = row[0] or 0
    returning = row[1] or 0
    pct = round((returning / total) * 100, 1) if total > 0 else 0
    return total, returning, pct


def kpi_atv(cur, start, end):
    """Average transaction value from POS transactions in period."""
    cur.execute("""
        SELECT
            COUNT(*) AS tx_count,
            COALESCE(AVG(total), 0) AS avg_value,
            COALESCE(SUM(total), 0) AS total_revenue
        FROM transactions
        WHERE created_at::date BETWEEN %s AND %s
          AND status IN ('completed', 'paid', 'done')
    """, (start, end))
    row = cur.fetchone()
    return {
        "count": row[0] or 0,
        "avg": round(float(row[1]), 2),
        "total": round(float(row[2]), 2),
    }


def kpi_ltv(cur):
    """Average lifetime value across all clients with at least 1 completed transaction."""
    cur.execute("""
        SELECT COALESCE(AVG(client_total), 0)
        FROM (
            SELECT client_id, SUM(total) AS client_total
            FROM transactions
            WHERE status IN ('completed', 'paid', 'done')
            GROUP BY client_id
        ) sub
    """)
    row = cur.fetchone()
    return round(float(row[0]), 2) if row else 0.0


def kpi_conversion(cur, start, end):
    """% of appointments that resulted in a completed transaction."""
    cur.execute("""
        SELECT COUNT(*) FROM appointments
        WHERE start_time::date BETWEEN %s AND %s
    """, (start, end))
    total_bookings = cur.fetchone()[0] or 0

    cur.execute("""
        SELECT COUNT(*) FROM appointments
        WHERE status IN ('completed', 'confirmed', 'done')
          AND start_time::date BETWEEN %s AND %s
    """, (start, end))
    completed = cur.fetchone()[0] or 0

    pct = round((completed / total_bookings) * 100, 1) if total_bookings > 0 else 0
    return total_bookings, completed, pct


def kpi_churn(cur, start, end):
    """
    Churn = clients who visited in [start, end] but NOT in the following equivalent window.
    Approximated as: clients active in period who have no appointment after [end].
    """
    period_len = (end - start).days
    next_end = end + timedelta(days=period_len)

    cur.execute("""
        SELECT COUNT(DISTINCT a.client_id)
        FROM appointments a
        WHERE a.status IN ('completed', 'confirmed', 'done')
          AND a.start_time::date BETWEEN %s AND %s
    """, (start, end))
    period_clients = cur.fetchone()[0] or 0

    cur.execute("""
        SELECT COUNT(DISTINCT a.client_id)
        FROM appointments a
        WHERE a.status IN ('completed', 'confirmed', 'done')
          AND a.start_time::date BETWEEN %s AND %s
          AND NOT EXISTS (
            SELECT 1 FROM appointments a2
            WHERE a2.client_id = a.client_id
              AND a2.status IN ('completed', 'confirmed', 'done')
              AND a2.start_time::date BETWEEN %s AND %s
          )
    """, (start, end, end, next_end))
    churned = cur.fetchone()[0] or 0

    pct = round((churned / period_clients) * 100, 1) if period_clients > 0 else 0
    return period_clients, churned, pct


def print_dashboard(metrics: dict, period: str, start, end):
    w = 52
    print("\n" + "=" * w)
    print(f"  MARKETING DASHBOARD — {period.upper()}")
    print(f"  {start} to {end}")
    print("=" * w)

    m = metrics
    print(f"\n  NEW CLIENTS           {m['new_clients']:>8}")
    print(f"  RETURNING CLIENTS     {m['returning_clients']:>8}")
    print(f"  RETENTION RATE        {m['retention_pct']:>7}%")
    print()
    print(f"  TOTAL BOOKINGS        {m['total_bookings']:>8}")
    print(f"  COMPLETED             {m['completed_bookings']:>8}")
    print(f"  BOOKING CONVERSION    {m['conversion_pct']:>7}%")
    print()
    print(f"  AVG TRANSACTION VALUE ${m['atv']:>7.2f}")
    print(f"  TOTAL REVENUE         ${m['total_revenue']:>7.2f}")
    print(f"  CLIENT LIFETIME VALUE ${m['ltv']:>7.2f}")
    print()
    print(f"  CHURN RATE            {m['churn_pct']:>7}%")
    print("=" * w)

    print("\n  TARGETS")
    print(f"  Retention       target >60%   {'OK' if m['retention_pct'] >= 60 else 'BELOW TARGET'}")
    print(f"  Conversion      target >85%   {'OK' if m['conversion_pct'] >= 85 else 'BELOW TARGET'}")
    print(f"  Churn           target <30%   {'OK' if m['churn_pct'] <= 30 else 'ABOVE TARGET'}")
    print()
    print(f"  See: marketing/workflows/06_metrics_dashboard.md for decision framework")
    print()


def append_to_log(metrics: dict, period: str, start, end):
    os.makedirs(os.path.dirname(METRICS_LOG) or ".", exist_ok=True)
    file_exists = os.path.exists(METRICS_LOG)
    with open(METRICS_LOG, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=LOG_COLUMNS)
        if not file_exists:
            writer.writeheader()
        writer.writerow({
            "snapshot_date": date.today().isoformat(),
            "period": period,
            "period_start": start.isoformat(),
            "period_end": end.isoformat(),
            "new_clients": metrics["new_clients"],
            "returning_clients": metrics["returning_clients"],
            "retention_pct": metrics["retention_pct"],
            "avg_transaction_value": metrics["atv"],
            "avg_lifetime_value": metrics["ltv"],
            "total_bookings": metrics["total_bookings"],
            "completed_bookings": metrics["completed_bookings"],
            "conversion_pct": metrics["conversion_pct"],
            "churn_pct": metrics["churn_pct"],
        })
    print(f"  Snapshot appended to {METRICS_LOG}")


def run_report(conn, period: str, single_kpi: str = None):
    start, end = date_range(period)
    cur = conn.cursor()

    try:
        new_clients = kpi_new_clients(cur, start, end)
        total_clients, returning, retention_pct = kpi_retention(cur, start, end)
        atv_data = kpi_atv(cur, start, end)
        ltv = kpi_ltv(cur)
        total_bookings, completed, conversion_pct = kpi_conversion(cur, start, end)
        period_clients, churned, churn_pct = kpi_churn(cur, start, end)
    except psycopg2.errors.UndefinedTable as e:
        print(f"\nWarning: a table doesn't exist yet — {e}")
        print("The metrics tool expects: clients, appointments, transactions tables.")
        print("Some KPIs will show 0 until those tables exist and contain data.")
        cur.close()
        return
    finally:
        pass

    metrics = {
        "new_clients": new_clients,
        "returning_clients": returning,
        "retention_pct": retention_pct,
        "atv": atv_data["avg"],
        "total_revenue": atv_data["total"],
        "ltv": ltv,
        "total_bookings": total_bookings,
        "completed_bookings": completed,
        "conversion_pct": conversion_pct,
        "churn_pct": churn_pct,
    }

    cur.close()

    if single_kpi:
        KPI_MAP = {
            "new_clients": f"New clients ({period}): {new_clients}",
            "retention":   f"Retention rate ({period}): {retention_pct}% ({returning}/{total_clients} clients returning)",
            "atv":         f"Avg transaction value ({period}): ${atv_data['avg']:.2f} across {atv_data['count']} transactions",
            "ltv":         f"Avg client lifetime value (all time): ${ltv:.2f}",
            "conversion":  f"Booking conversion ({period}): {conversion_pct}% ({completed}/{total_bookings})",
            "churn":       f"Churn rate ({period}): {churn_pct}% ({churned}/{period_clients} clients didn't return)",
        }
        print(f"\n  {KPI_MAP.get(single_kpi, 'Unknown KPI')}\n")
        return

    print_dashboard(metrics, period, start, end)
    append_to_log(metrics, period, start, end)


def main():
    parser = argparse.ArgumentParser(description="Pull marketing KPIs from the booking database.")
    parser.add_argument("--weekly", action="store_true", help="7-day report")
    parser.add_argument("--monthly", action="store_true", help="Current calendar month report")
    parser.add_argument("--kpi", choices=["new_clients", "retention", "atv", "ltv", "conversion", "churn"],
                        help="Print a single KPI only")
    args = parser.parse_args()

    period = "monthly" if args.monthly else "weekly" if args.weekly else "monthly"

    try:
        conn = get_connection()
    except Exception as e:
        print(f"DB connection failed: {e}")
        return

    try:
        run_report(conn, period, single_kpi=args.kpi)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
