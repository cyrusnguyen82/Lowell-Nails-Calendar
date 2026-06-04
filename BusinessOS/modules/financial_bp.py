"""
financial_bp.py — Financial Dashboard module Blueprint
"""
import os, sys
from datetime import date, timedelta
from flask import Blueprint, render_template, request, jsonify, redirect, url_for, flash

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from BusinessOS.core.db import get_db, get_company, get_active_modules, fmt_currency
from BusinessOS.core.auth import login_required, module_required

financial_bp = Blueprint("financial", __name__, template_folder="../templates")

VALID_CATEGORIES = [
    "supplies", "rent", "utilities", "software", "marketing",
    "professional_services", "equipment", "insurance", "meals",
    "travel", "payroll", "taxes", "other",
]


@financial_bp.route("/")
@login_required
@module_required("financial")
def index():
    conn = get_db(); cur = conn.cursor()
    company = get_company(cur)
    modules = get_active_modules(cur, company["id"])

    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)
    year_start  = today.replace(month=1, day=1)

    def q(sql, *args):
        cur.execute(sql, args)
        r = cur.fetchone()
        return float(r[0]) if r and r[0] else 0.0

    # Revenue
    rev_week  = q("SELECT COALESCE(SUM(total),0) FROM transactions WHERE created_at::date >= %s AND status IN ('completed','paid','done') AND total > 0", week_start)
    rev_month = q("SELECT COALESCE(SUM(total),0) FROM transactions WHERE created_at::date >= %s AND status IN ('completed','paid','done') AND total > 0", month_start)
    rev_year  = q("SELECT COALESCE(SUM(total),0) FROM transactions WHERE created_at::date >= %s AND status IN ('completed','paid','done') AND total > 0", year_start)

    # Prior period comparisons
    last_week  = week_start  - timedelta(weeks=1)
    last_month = month_start - timedelta(days=1)
    last_month_start = last_month.replace(day=1)
    rev_last_week  = q("SELECT COALESCE(SUM(total),0) FROM transactions WHERE created_at::date BETWEEN %s AND %s AND status IN ('completed','paid','done') AND total > 0", last_week, week_start - timedelta(days=1))
    rev_last_month = q("SELECT COALESCE(SUM(total),0) FROM transactions WHERE created_at::date BETWEEN %s AND %s AND status IN ('completed','paid','done') AND total > 0", last_month_start, last_month)

    # Expenses
    exp_month = q("SELECT COALESCE(SUM(amount),0) FROM expenses WHERE expense_date >= %s AND personal = FALSE", month_start)
    exp_year  = q("SELECT COALESCE(SUM(amount),0) FROM expenses WHERE expense_date >= %s AND personal = FALSE", year_start)

    # Payroll this month
    payroll_month = q("""
        SELECT COALESCE(SUM(gross_pay),0) FROM payroll_entries pe
        JOIN payroll_runs pr ON pr.id = pe.run_id
        WHERE pr.pay_period_start >= %s AND pr.status IN ('approved','paid')
    """, month_start)

    # Profit estimate
    profit_month = rev_month - exp_month - payroll_month

    # Monthly revenue trend (last 6 months)
    trend = []
    for i in range(5, -1, -1):
        ms = (today.replace(day=1) - timedelta(days=i*28)).replace(day=1)
        me = (ms.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
        cur.execute("""
            SELECT COALESCE(SUM(total),0) FROM transactions
            WHERE created_at::date BETWEEN %s AND %s AND status IN ('completed','paid','done') AND total>0
        """, (ms, me))
        trend.append({"month": ms.strftime("%b"), "revenue": float(cur.fetchone()[0])})

    # Expense by category this month
    cur.execute("""
        SELECT category, COALESCE(SUM(amount),0) AS total
        FROM expenses WHERE expense_date >= %s AND personal = FALSE
        GROUP BY category ORDER BY total DESC
    """, (month_start,))
    exp_by_cat = [dict(r) for r in cur.fetchall()]

    # Recent expenses
    cur.execute("""
        SELECT id, amount, category, note, expense_date, recurring
        FROM expenses ORDER BY expense_date DESC, id DESC LIMIT 10
    """)
    recent_exp = [dict(r) for r in cur.fetchall()]

    cur.close(); conn.close()
    return render_template("financial/index.html",
        company=company, modules=modules,
        rev_week=rev_week, rev_month=rev_month, rev_year=rev_year,
        rev_last_week=rev_last_week, rev_last_month=rev_last_month,
        exp_month=exp_month, exp_year=exp_year,
        payroll_month=payroll_month, profit_month=profit_month,
        trend=trend, exp_by_cat=exp_by_cat, recent_exp=recent_exp,
        categories=VALID_CATEGORIES, fmt=fmt_currency, today=today, page="financial",
    )


@financial_bp.route("/expenses/add", methods=["POST"])
@login_required
@module_required("financial")
def add_expense():
    f = request.form
    conn = get_db(); cur = conn.cursor()
    cur.execute("""
        INSERT INTO expenses (amount, category, note, expense_date, recurring, personal, vendor)
        VALUES (%s,%s,%s,%s,%s,%s,%s)
    """, (
        float(f["amount"]), f.get("category","other"), f.get("note",""),
        f.get("expense_date") or date.today(),
        f.get("recurring") == "on",
        f.get("personal") == "on",
        f.get("vendor",""),
    ))
    conn.commit(); cur.close(); conn.close()
    flash("Expense added.", "success")
    return redirect(url_for("financial.index"))


@financial_bp.route("/expenses/<int:exp_id>/delete", methods=["POST"])
@login_required
@module_required("financial")
def delete_expense(exp_id):
    conn = get_db(); cur = conn.cursor()
    cur.execute("DELETE FROM expenses WHERE id=%s", (exp_id,))
    conn.commit(); cur.close(); conn.close()
    flash("Expense deleted.", "success")
    return redirect(url_for("financial.index"))
