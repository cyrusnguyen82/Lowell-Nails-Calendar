"""
payroll_bp.py — Payroll module Blueprint

Routes:
    GET  /payroll/               → Payroll home: recent runs + employee summary
    GET  /payroll/employees      → Employee list + add/edit forms
    POST /payroll/employees/save → Save employee record (add or update)
    GET  /payroll/run            → Pay run wizard (period selection)
    POST /payroll/run/preview    → AJAX: compute payroll, return JSON
    POST /payroll/run/save       → Save payroll run
    GET  /payroll/run/<id>/stubs → Printable pay stubs
    POST /payroll/run/<id>/approve → Mark run as paid
    POST /payroll/run/<id>/void  → Void a run
    GET  /payroll/reports        → Tax reports hub
    GET  /payroll/reports/data   → AJAX: return report data as JSON
"""

import os, sys
from datetime import date, timedelta
from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for, flash

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from BusinessOS.core.db import get_db, get_company, get_active_modules, fmt_currency
from BusinessOS.core.auth import login_required, module_required

payroll_bp = Blueprint("payroll", __name__, template_folder="../templates")

PAY_PERIODS = 52


def _prior_week():
    today = date.today()
    monday = today - timedelta(days=today.weekday() + 7)
    return monday, monday + timedelta(days=6)


def _ytd(cur, tech_id, period_start):
    year_start = date(period_start.year, 1, 1)
    cur.execute("""
        SELECT
            COALESCE(SUM(pe.gross_pay),0)                             AS ytd_gross,
            COALESCE(SUM(pe.federal_income_tax),0)                    AS ytd_federal,
            COALESCE(SUM(pe.social_security_tax),0)                   AS ytd_ss_tax,
            COALESCE(SUM(pe.medicare_tax + pe.additional_medicare),0) AS ytd_medicare,
            COALESCE(SUM(pe.state_income_tax),0)                      AS ytd_state,
            COALESCE(SUM(pe.state_sdi),0)                             AS ytd_sdi,
            COALESCE(SUM(pe.city_income_tax),0)                       AS ytd_city
        FROM payroll_entries pe
        JOIN payroll_runs pr ON pr.id = pe.run_id
        WHERE pe.technician_id = %s
          AND pr.pay_period_start >= %s AND pr.pay_period_start < %s
          AND pr.status IN ('approved','paid')
    """, (tech_id, year_start, period_start))
    r = cur.fetchone()
    return {k: float(v) for k, v in r.items()} if r else {
        "ytd_gross":0.0,"ytd_federal":0.0,"ytd_ss_tax":0.0,
        "ytd_medicare":0.0,"ytd_state":0.0,"ytd_sdi":0.0,"ytd_city":0.0,
    }


@payroll_bp.route("/")
@login_required
@module_required("payroll")
def index():
    conn = get_db(); cur = conn.cursor()
    company  = get_company(cur)
    modules  = get_active_modules(cur, company["id"])

    cur.execute("""
        SELECT id, pay_period_start, pay_period_end, pay_date, status,
               total_gross, total_net, total_employer_tax
        FROM payroll_runs ORDER BY pay_period_start DESC LIMIT 8
    """)
    runs = [dict(r) for r in cur.fetchall()]

    cur.execute("SELECT COUNT(*) AS cnt FROM employees WHERE active=TRUE")
    emp_count = cur.fetchone()["cnt"]
    cur.execute("SELECT COUNT(*) AS cnt FROM employees WHERE active=TRUE AND employee_type='w2'")
    w2_count = cur.fetchone()["cnt"]
    cur.execute("SELECT COUNT(*) AS cnt FROM employees WHERE active=TRUE AND employee_type='contractor'")
    cont_count = cur.fetchone()["cnt"]

    # Next payroll preview
    ps, pe = _prior_week()
    next_ps = ps + timedelta(weeks=1)
    next_pe = pe + timedelta(weeks=1)

    cur.close(); conn.close()
    return render_template("payroll/index.html",
        company=company, modules=modules,
        runs=runs, emp_count=emp_count, w2_count=w2_count, cont_count=cont_count,
        next_period_start=next_ps, next_period_end=next_pe,
        fmt=fmt_currency, page="payroll",
    )


@payroll_bp.route("/employees")
@login_required
@module_required("payroll")
def employees():
    conn = get_db(); cur = conn.cursor()
    company = get_company(cur)
    modules = get_active_modules(cur, company["id"])

    cur.execute("""
        SELECT e.*, t.first_name, t.last_name, t.phone
        FROM employees e
        JOIN technicians t ON t.id = e.technician_id
        ORDER BY e.active DESC, t.first_name
    """)
    emps = [dict(r) for r in cur.fetchall()]

    cur.execute("""
        SELECT t.id, t.first_name, t.last_name
        FROM technicians t
        WHERE t.id NOT IN (SELECT technician_id FROM employees)
        ORDER BY t.first_name
    """)
    unlinked = [dict(r) for r in cur.fetchall()]

    cur.close(); conn.close()
    return render_template("payroll/employees.html",
        company=company, modules=modules,
        employees=emps, unlinked=unlinked, fmt=fmt_currency, page="payroll",
    )


@payroll_bp.route("/employees/save", methods=["POST"])
@login_required
@module_required("payroll")
def save_employee():
    f = request.form
    tech_id = int(f["technician_id"])
    conn = get_db(); cur = conn.cursor()

    cur.execute("SELECT id FROM employees WHERE technician_id=%s", (tech_id,))
    existing = cur.fetchone()

    fields = dict(
        employee_type   = f.get("employee_type","w2"),
        filing_status   = f.get("filing_status","single"),
        federal_allowances = int(f.get("federal_allowances",0) or 0),
        federal_extra_withholding = float(f.get("federal_extra_withholding",0) or 0),
        state_code      = (f.get("state_code") or "").upper() or None,
        state_allowances = int(f.get("state_allowances",0) or 0),
        state_extra_withholding = float(f.get("state_extra_withholding",0) or 0),
        city_code       = (f.get("city_code") or "").strip().lower() or None,
        city_resident   = f.get("city_resident","resident") == "resident",
        pay_basis       = f.get("pay_basis","hourly"),
        hourly_rate     = float(f.get("hourly_rate",0) or 0),
        salary_annual   = float(f.get("salary_annual",0) or 0),
        commission_rate = float(f.get("commission_rate",0.45) or 0.45),
        ssn_last4       = (f.get("ssn_last4") or "").strip() or None,
        email           = (f.get("email") or "").strip() or None,
        notes           = f.get("notes",""),
        active          = True,
    )

    if existing:
        set_clause = ", ".join(f"{k}=%s" for k in fields)
        cur.execute(
            f"UPDATE employees SET {set_clause}, updated_at=NOW() WHERE technician_id=%s",
            [*fields.values(), tech_id]
        )
    else:
        keys = ", ".join(["technician_id"] + list(fields.keys()))
        vals = ", ".join(["%s"] * (len(fields) + 1))
        cur.execute(
            f"INSERT INTO employees ({keys}) VALUES ({vals})",
            [tech_id] + list(fields.values())
        )

    conn.commit(); cur.close(); conn.close()
    flash("Employee record saved.", "success")
    return redirect(url_for("payroll.employees"))


@payroll_bp.route("/run")
@login_required
@module_required("payroll")
def run_page():
    conn = get_db(); cur = conn.cursor()
    company = get_company(cur)
    modules = get_active_modules(cur, company["id"])
    ps, pe = _prior_week()
    cur.close(); conn.close()
    return render_template("payroll/run.html",
        company=company, modules=modules,
        default_start=ps, default_end=pe, page="payroll",
    )


@payroll_bp.route("/run/preview", methods=["POST"])
@login_required
@module_required("payroll")
def run_preview():
    """AJAX: compute payroll for given period. Returns JSON."""
    from Financial.tools.payroll.tax_tables import (
        calc_federal_withholding, calc_state_withholding, calc_state_sdi,
        calc_fica, calc_futa, calc_suta, effective_state, calc_city_withholding,
        tax_table_age_warning,
    )

    warning = tax_table_age_warning()
    if warning:
        import warnings; warnings.warn(warning)

    data = request.get_json()
    period_start = date.fromisoformat(data["period_start"])
    period_end   = date.fromisoformat(data["period_end"])
    employer_state = os.getenv("EMPLOYER_STATE", "MI")

    conn = get_db(); cur = conn.cursor()
    cur.execute("""
        SELECT e.*, t.first_name || ' ' || t.last_name AS name
        FROM employees e JOIN technicians t ON t.id = e.technician_id
        WHERE e.active = TRUE
    """)
    employees = [dict(r) for r in cur.fetchall()]

    entries = []
    for emp in employees:
        tech_id = emp["technician_id"]
        basis   = emp["pay_basis"]

        # Gross
        reg = ot = comm = hours = 0.0
        hr = float(emp["hourly_rate"] or 0)

        if basis in ("hourly","hybrid"):
            try:
                cur.execute("""
                    SELECT COALESCE(SUM(hours_worked),0) AS h FROM time_entries
                    WHERE technician_id=%s AND clock_in::date BETWEEN %s AND %s AND hours_worked IS NOT NULL
                """, (tech_id, period_start, period_end))
                hours = float(cur.fetchone()["h"])
            except Exception:
                hours = 0.0
            reg  = min(hours, 40.0) * hr
            ot   = max(hours - 40.0, 0.0) * hr * 1.5

        if basis == "salary":
            reg = float(emp["salary_annual"] or 0) / PAY_PERIODS

        if basis in ("commission","hybrid"):
            try:
                cur.execute("""
                    SELECT COALESCE(SUM(total),0) AS r FROM transactions
                    WHERE technician_id=%s AND created_at::date BETWEEN %s AND %s
                      AND status IN ('completed','paid','done') AND total > 0
                """, (tech_id, period_start, period_end))
                rev  = float(cur.fetchone()["r"])
                comm = rev * float(emp["commission_rate"] or 0.45)
            except Exception:
                comm = 0.0

        gross = round(reg + ot + comm, 2)
        if gross == 0:
            continue

        ytd = _ytd(cur, tech_id, period_start)

        if emp["employee_type"] == "w2":
            state    = effective_state(emp["state_code"], employer_state)
            fica     = calc_fica(gross, ytd["ytd_gross"])
            fed      = calc_federal_withholding(gross, emp["filing_status"],
                           emp["federal_allowances"] or 0, emp["federal_extra_withholding"] or 0, PAY_PERIODS)
            st_wh    = calc_state_withholding(gross, state, emp["filing_status"],
                           emp["state_allowances"] or 0, emp["state_extra_withholding"] or 0, PAY_PERIODS)
            sdi      = calc_state_sdi(gross, state, ytd["ytd_sdi"])
            city_tax = calc_city_withholding(gross, state,
                           emp.get("city_code"), emp.get("city_resident", True))
            futa     = calc_futa(gross, ytd["ytd_gross"])
            suta     = calc_suta(gross, ytd["ytd_gross"], state, emp.get("suta_rate"))

            total_ded = round(fed + fica["employee_ss"] + fica["employee_medicare"]
                              + fica["additional_medicare"] + st_wh + sdi + city_tax, 2)
            total_er  = round(fica["employer_ss"] + fica["employer_medicare"] + futa + suta, 2)
            net       = round(gross - total_ded, 2)

            taxes = dict(
                federal=fed, ss_emp=fica["employee_ss"], med_emp=fica["employee_medicare"],
                add_med=fica["additional_medicare"], state_wh=st_wh, sdi=sdi,
                city_tax=city_tax,
                er_ss=fica["employer_ss"], er_med=fica["employer_medicare"],
                futa=futa, suta=suta, total_ded=total_ded, total_er=total_er,
            )
        else:
            taxes = {k: 0.0 for k in ["federal","ss_emp","med_emp","add_med","state_wh",
                                        "sdi","city_tax","er_ss","er_med","futa","suta",
                                        "total_ded","total_er"]}
            net = gross

        entries.append({
            "tech_id":   tech_id,
            "name":      emp["name"],
            "type":      emp["employee_type"],
            "basis":     basis,
            "hours":     hours,
            "rate":      hr,
            "gross":     gross,
            "net":       net,
            "taxes":     {k: round(float(v), 2) for k, v in taxes.items()},
            "ytd_gross": ytd["ytd_gross"],
        })

    cur.close(); conn.close()

    total_gross  = round(sum(e["gross"] for e in entries), 2)
    total_net    = round(sum(e["net"] for e in entries), 2)
    total_er_tax = round(sum(e["taxes"]["total_er"] for e in entries), 2)

    return jsonify({
        "success": True,
        "entries": entries,
        "total_gross": total_gross,
        "total_net": total_net,
        "total_er_tax": total_er_tax,
        "period_start": period_start.isoformat(),
        "period_end":   period_end.isoformat(),
    })


@payroll_bp.route("/run/save", methods=["POST"])
@login_required
@module_required("payroll")
def run_save():
    from Financial.tools.payroll.tax_tables import (
        calc_federal_withholding, calc_state_withholding, calc_state_sdi,
        calc_fica, calc_futa, calc_suta, effective_state, calc_city_withholding,
    )

    data = request.get_json()
    period_start = date.fromisoformat(data["period_start"])
    period_end   = date.fromisoformat(data["period_end"])
    employer_state = os.getenv("EMPLOYER_STATE","MI")
    days_to_fri  = (4 - period_end.weekday()) % 7 or 7
    pay_date     = period_end + timedelta(days=days_to_fri)

    conn = get_db(); cur = conn.cursor()

    # Duplicate check
    cur.execute("""
        SELECT id FROM payroll_runs
        WHERE pay_period_start=%s AND pay_period_end=%s AND status != 'void'
    """, (period_start, period_end))
    if cur.fetchone():
        cur.close(); conn.close()
        return jsonify({"success": False, "error": "A run for this period already exists."})

    entries_data = data.get("entries", [])
    total_gross = total_net = total_ded = total_er = 0.0

    cur.execute("""
        INSERT INTO payroll_runs (pay_period_start, pay_period_end, pay_date, status)
        VALUES (%s,%s,%s,'draft') RETURNING id
    """, (period_start, period_end, pay_date))
    run_id = cur.fetchone()["id"]

    for e in entries_data:
        tech_id = e["tech_id"]
        gross   = e["gross"]
        taxes   = e["taxes"]
        ytd     = _ytd(cur, tech_id, period_start)
        net     = round(gross - taxes.get("total_ded", 0), 2)

        cur.execute("""
            INSERT INTO payroll_entries (
                run_id, technician_id, employee_type,
                hours_worked, hourly_rate, regular_pay, overtime_pay, commission_pay, gross_pay,
                federal_income_tax, social_security_tax, medicare_tax, additional_medicare,
                state_income_tax, state_sdi, city_income_tax,
                federal_extra_wh, state_extra_wh, total_deductions,
                employer_ss, employer_medicare, employer_futa, employer_suta, total_employer_tax,
                net_pay,
                ytd_gross, ytd_federal_tax, ytd_ss_wages, ytd_ss_tax,
                ytd_medicare_tax, ytd_state_tax, ytd_sdi, ytd_city_tax
            ) VALUES (
                %s,%s,%s,
                %s,%s,%s,%s,%s,%s,
                %s,%s,%s,%s,%s,%s,%s,
                %s,%s,%s,
                %s,%s,%s,%s,%s,
                %s,
                %s,%s,%s,%s,%s,%s,%s,%s
            )
        """, (
            run_id, tech_id, e["type"],
            e.get("hours",0), e.get("rate",0), e.get("reg",e["gross"]), e.get("ot",0), e.get("comm",0), gross,
            taxes.get("federal",0), taxes.get("ss_emp",0), taxes.get("med_emp",0), taxes.get("add_med",0),
            taxes.get("state_wh",0), taxes.get("sdi",0), taxes.get("city_tax",0),
            taxes.get("federal_extra",0), taxes.get("state_extra",0), taxes.get("total_ded",0),
            taxes.get("er_ss",0), taxes.get("er_med",0), taxes.get("futa",0), taxes.get("suta",0), taxes.get("total_er",0),
            net,
            ytd["ytd_gross"], ytd["ytd_federal"], ytd["ytd_gross"], ytd["ytd_ss_tax"],
            ytd["ytd_medicare"], ytd["ytd_state"], ytd["ytd_sdi"], ytd["ytd_city"],
        ))
        total_gross += gross; total_net += net; total_ded += taxes.get("total_ded",0); total_er += taxes.get("total_er",0)

    cur.execute("""
        UPDATE payroll_runs SET total_gross=%s, total_net=%s, total_employee_tax=%s, total_employer_tax=%s
        WHERE id=%s
    """, (round(total_gross,2), round(total_net,2), round(total_ded,2), round(total_er,2), run_id))
    conn.commit(); cur.close(); conn.close()
    return jsonify({"success": True, "run_id": run_id})


@payroll_bp.route("/run/<int:run_id>/stubs")
@login_required
@module_required("payroll")
def stubs(run_id):
    conn = get_db(); cur = conn.cursor()
    company = get_company(cur)
    modules = get_active_modules(cur, company["id"])

    cur.execute("""
        SELECT pe.*, t.first_name || ' ' || t.last_name AS name,
               pr.pay_period_start, pr.pay_period_end, pr.pay_date
        FROM payroll_entries pe
        JOIN technicians t ON t.id = pe.technician_id
        JOIN payroll_runs pr ON pr.id = pe.run_id
        WHERE pe.run_id=%s ORDER BY t.first_name
    """, (run_id,))
    entries = []
    for r in cur.fetchall():
        row = dict(r)
        cur.execute("SELECT * FROM employees WHERE technician_id=%s", (r["technician_id"],))
        emp = cur.fetchone()
        row["emp"] = dict(emp) if emp else {}
        entries.append(row)

    cur.execute("SELECT * FROM payroll_runs WHERE id=%s", (run_id,))
    run = dict(cur.fetchone())
    cur.close(); conn.close()

    return render_template("payroll/stubs.html",
        company=company, modules=modules,
        entries=entries, run=run, fmt=fmt_currency,
        employer_state=os.getenv("EMPLOYER_STATE",""), page="payroll",
    )


@payroll_bp.route("/run/<int:run_id>/approve", methods=["POST"])
@login_required
@module_required("payroll")
def approve_run(run_id):
    conn = get_db(); cur = conn.cursor()
    cur.execute("UPDATE payroll_runs SET status='paid' WHERE id=%s", (run_id,))
    conn.commit(); cur.close(); conn.close()
    flash(f"Run #{run_id} marked as paid. YTD totals updated.", "success")
    return redirect(url_for("payroll.index"))


@payroll_bp.route("/run/<int:run_id>/void", methods=["POST"])
@login_required
@module_required("payroll")
def void_run(run_id):
    conn = get_db(); cur = conn.cursor()
    cur.execute("UPDATE payroll_runs SET status='void' WHERE id=%s", (run_id,))
    conn.commit(); cur.close(); conn.close()
    flash(f"Run #{run_id} voided.", "warning")
    return redirect(url_for("payroll.index"))


@payroll_bp.route("/reports")
@login_required
@module_required("payroll")
def reports():
    conn = get_db(); cur = conn.cursor()
    company = get_company(cur)
    modules = get_active_modules(cur, company["id"])
    cur.close(); conn.close()
    today = date.today()
    year  = today.year
    deadlines = [
        {"name": f"Form 941 — Q1 {year}", "due": date(year,4,30),  "form": "941"},
        {"name": f"Form 941 — Q2 {year}", "due": date(year,7,31),  "form": "941"},
        {"name": f"Form 941 — Q3 {year}", "due": date(year,10,31), "form": "941"},
        {"name": f"Form 941 — Q4 {year}", "due": date(year+1,1,31),"form": "941"},
        {"name": f"Form 940 (FUTA) — {year}", "due": date(year+1,1,31), "form": "940"},
        {"name": f"W-2s to employees — {year}", "due": date(year+1,1,31), "form": "w2"},
        {"name": f"1099-NEC to contractors — {year}", "due": date(year+1,1,31),"form": "1099"},
    ]
    upcoming = [d for d in deadlines if d["due"] >= today]
    return render_template("payroll/reports.html",
        company=company, modules=modules,
        deadlines=upcoming, today=today, page="payroll",
        employer_ein=os.getenv("EMPLOYER_EIN","(set EMPLOYER_EIN in .env)"),
    )
