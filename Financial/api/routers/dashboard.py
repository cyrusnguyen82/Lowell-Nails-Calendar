"""
dashboard.py — Top-level KPI summary. Ported from BusinessOS/app.py::dashboard().

Timeclock/Calendar widgets are intentionally omitted here — those already
live in POS_System/ui and Calendar/frontend; this app only covers
Financial + Payroll.
"""
from datetime import date, timedelta
from fastapi import APIRouter, Request

from db import get_db
from auth import require_login

dashboard_router = APIRouter(tags=["dashboard"])


def _q(cur, sql, *args):
    try:
        cur.execute(sql, args)
        r = cur.fetchone()
        val = list(r.values())[0] if r else None
        return float(val) if val is not None else 0.0
    except Exception:
        return 0.0


@dashboard_router.get("/dashboard")
def get_dashboard(request: Request):
    require_login(request)
    conn = get_db(); cur = conn.cursor()

    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)

    rev_week = _q(cur, "SELECT COALESCE(SUM(total),0) FROM pos_transactions WHERE created_at::date >= %s AND status='completed' AND total>0", week_start)
    rev_month = _q(cur, "SELECT COALESCE(SUM(total),0) FROM pos_transactions WHERE created_at::date >= %s AND status='completed' AND total>0", month_start)

    payroll_week_gross = _q(cur, """
        SELECT COALESCE(SUM(pe.gross_pay),0) FROM payroll_entries pe
        JOIN payroll_runs pr ON pr.id=pe.run_id
        WHERE pr.pay_period_start >= %s
    """, week_start)

    hours_week = _q(cur, """
        SELECT COALESCE(SUM(hours_worked),0) FROM time_entries
        WHERE clock_in::date >= %s AND hours_worked IS NOT NULL
    """, week_start)

    emp_count = int(_q(cur, "SELECT COUNT(*) FROM employees WHERE active=TRUE"))

    try:
        cur.execute("""
            SELECT id, pay_period_start, pay_period_end, status, total_gross, total_net
            FROM payroll_runs ORDER BY pay_period_start DESC LIMIT 5
        """)
        recent_runs = [dict(r) for r in cur.fetchall()]
    except Exception:
        recent_runs = []

    year = today.year
    all_deadlines = [
        {"name": f"Form 941 Q1 {year}", "due": date(year,4,30)},
        {"name": f"Form 941 Q2 {year}", "due": date(year,7,31)},
        {"name": f"Form 941 Q3 {year}", "due": date(year,10,31)},
        {"name": f"Form 941 Q4 {year}", "due": date(year+1,1,31)},
        {"name": f"Form 940 (FUTA) {year}", "due": date(year+1,1,31)},
        {"name": f"W-2 / 1099-NEC {year}", "due": date(year+1,1,31)},
    ]
    upcoming = [d for d in all_deadlines if today <= d["due"] <= today + timedelta(days=60)]
    for d in upcoming:
        d["days_away"] = (d["due"] - today).days

    cur.close(); conn.close()
    return {
        "rev_week": rev_week, "rev_month": rev_month,
        "payroll_week_gross": payroll_week_gross,
        "hours_week": hours_week, "emp_count": emp_count,
        "recent_runs": recent_runs, "upcoming_deadlines": upcoming,
    }
