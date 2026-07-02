"""
financial.py — Financial dashboard: revenue, expenses, P&L. Ported from
BusinessOS/modules/financial_bp.py.

NOTE: the original queried a `transactions` table that doesn't exist in
this DB (only `pos_transactions` does) — that bug is fixed here by
querying `pos_transactions` with status='completed', matching what the
POS backend actually writes.
"""
from datetime import date, timedelta
from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Optional

from db import get_db
from auth import require_login, check_module

financial_router = APIRouter(tags=["financial"])

VALID_CATEGORIES = [
    "supplies", "rent", "utilities", "software", "marketing",
    "professional_services", "equipment", "insurance", "meals",
    "travel", "payroll", "taxes", "other",
]


def _q(cur, sql, *args):
    cur.execute(sql, args)
    r = cur.fetchone()
    val = list(r.values())[0] if r else None
    return float(val) if val else 0.0


@financial_router.get("")
def get_financial(request: Request):
    require_login(request)
    check_module(request, "financial")
    conn = get_db(); cur = conn.cursor()

    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)
    year_start = today.replace(month=1, day=1)

    rev_week = _q(cur, "SELECT COALESCE(SUM(total),0) FROM pos_transactions WHERE created_at::date >= %s AND status='completed' AND total > 0", week_start)
    rev_month = _q(cur, "SELECT COALESCE(SUM(total),0) FROM pos_transactions WHERE created_at::date >= %s AND status='completed' AND total > 0", month_start)
    rev_year = _q(cur, "SELECT COALESCE(SUM(total),0) FROM pos_transactions WHERE created_at::date >= %s AND status='completed' AND total > 0", year_start)

    last_week = week_start - timedelta(weeks=1)
    last_month = month_start - timedelta(days=1)
    last_month_start = last_month.replace(day=1)
    rev_last_week = _q(cur, "SELECT COALESCE(SUM(total),0) FROM pos_transactions WHERE created_at::date BETWEEN %s AND %s AND status='completed' AND total > 0", last_week, week_start - timedelta(days=1))
    rev_last_month = _q(cur, "SELECT COALESCE(SUM(total),0) FROM pos_transactions WHERE created_at::date BETWEEN %s AND %s AND status='completed' AND total > 0", last_month_start, last_month)

    exp_month = _q(cur, "SELECT COALESCE(SUM(amount),0) FROM expenses WHERE expense_date >= %s AND personal = FALSE", month_start)
    exp_year = _q(cur, "SELECT COALESCE(SUM(amount),0) FROM expenses WHERE expense_date >= %s AND personal = FALSE", year_start)

    payroll_month = _q(cur, """
        SELECT COALESCE(SUM(gross_pay),0) FROM payroll_entries pe
        JOIN payroll_runs pr ON pr.id = pe.run_id
        WHERE pr.pay_period_start >= %s AND pr.status IN ('approved','paid')
    """, month_start)

    profit_month = rev_month - exp_month - payroll_month

    trend = []
    for i in range(5, -1, -1):
        ms = (today.replace(day=1) - timedelta(days=i*28)).replace(day=1)
        me = (ms.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
        cur.execute("""
            SELECT COALESCE(SUM(total),0) FROM pos_transactions
            WHERE created_at::date BETWEEN %s AND %s AND status='completed' AND total>0
        """, (ms, me))
        trend.append({"month": ms.strftime("%b"), "revenue": float(cur.fetchone()["coalesce"])})

    cur.execute("""
        SELECT category, COALESCE(SUM(amount),0) AS total
        FROM expenses WHERE expense_date >= %s AND personal = FALSE
        GROUP BY category ORDER BY total DESC
    """, (month_start,))
    exp_by_cat = [{"category": r["category"], "total": float(r["total"])} for r in cur.fetchall()]

    cur.execute("""
        SELECT id, amount, category, note, expense_date, recurring
        FROM expenses ORDER BY expense_date DESC, id DESC LIMIT 10
    """)
    recent_exp = [dict(r) for r in cur.fetchall()]

    cur.close(); conn.close()
    return {
        "rev_week": rev_week, "rev_month": rev_month, "rev_year": rev_year,
        "rev_last_week": rev_last_week, "rev_last_month": rev_last_month,
        "exp_month": exp_month, "exp_year": exp_year,
        "payroll_month": payroll_month, "profit_month": profit_month,
        "trend": trend, "exp_by_cat": exp_by_cat, "recent_exp": recent_exp,
        "categories": VALID_CATEGORIES,
    }


class ExpenseRequest(BaseModel):
    amount: float
    category: str = "other"
    note: str = ""
    expense_date: Optional[str] = None
    recurring: bool = False
    personal: bool = False
    vendor: str = ""


@financial_router.post("/expenses")
def add_expense(req: ExpenseRequest, request: Request):
    require_login(request)
    check_module(request, "financial")
    conn = get_db(); cur = conn.cursor()
    cur.execute("""
        INSERT INTO expenses (amount, category, note, expense_date, recurring, personal, vendor)
        VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id
    """, (
        req.amount, req.category, req.note,
        req.expense_date or date.today().isoformat(),
        req.recurring, req.personal, req.vendor,
    ))
    new_id = cur.fetchone()["id"]
    conn.commit(); cur.close(); conn.close()
    return {"success": True, "id": new_id}


@financial_router.delete("/expenses/{exp_id}")
def delete_expense(exp_id: int, request: Request):
    require_login(request)
    check_module(request, "financial")
    conn = get_db(); cur = conn.cursor()
    cur.execute("DELETE FROM expenses WHERE id=%s", (exp_id,))
    conn.commit(); cur.close(); conn.close()
    return {"success": True}
