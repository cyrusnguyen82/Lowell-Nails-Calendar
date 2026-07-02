"""
payroll.py — Employees, payroll runs, stubs, tax reports. Ported from
BusinessOS/modules/payroll_bp.py. Tax/withholding math is untouched —
imported directly from Financial/tools/payroll/tax_tables.py.

NOTE: the original commission query used a nonexistent `transactions`
table (see financial.py note) — fixed here to use `pos_transactions`
with status='completed'.
"""
import os
from datetime import date, timedelta
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional

from db import get_db
from auth import require_login, check_module

payroll_router = APIRouter(tags=["payroll"])

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


@payroll_router.get("")
def payroll_index(request: Request):
    require_login(request)
    check_module(request, "payroll")
    conn = get_db(); cur = conn.cursor()

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

    ps, pe = _prior_week()
    next_ps, next_pe = ps + timedelta(weeks=1), pe + timedelta(weeks=1)

    cur.close(); conn.close()
    return {
        "runs": runs, "emp_count": emp_count, "w2_count": w2_count, "cont_count": cont_count,
        "next_period_start": next_ps.isoformat(), "next_period_end": next_pe.isoformat(),
    }


@payroll_router.get("/employees")
def list_employees(request: Request):
    require_login(request)
    check_module(request, "payroll")
    conn = get_db(); cur = conn.cursor()

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
    return {"employees": emps, "unlinked": unlinked}


class EmployeeRequest(BaseModel):
    technician_id: int
    employee_type: str = "w2"
    filing_status: str = "single"
    federal_allowances: int = 0
    federal_extra_withholding: float = 0
    state_code: Optional[str] = None
    state_allowances: int = 0
    state_extra_withholding: float = 0
    city_code: Optional[str] = None
    city_resident: bool = True
    pay_basis: str = "hourly"
    hourly_rate: float = 0
    salary_annual: float = 0
    commission_rate: float = 0.45
    ssn_last4: Optional[str] = None
    email: Optional[str] = None
    notes: str = ""


@payroll_router.post("/employees")
def save_employee(req: EmployeeRequest, request: Request):
    require_login(request)
    check_module(request, "payroll")
    conn = get_db(); cur = conn.cursor()

    cur.execute("SELECT id FROM employees WHERE technician_id=%s", (req.technician_id,))
    existing = cur.fetchone()

    fields = dict(
        employee_type=req.employee_type, filing_status=req.filing_status,
        federal_allowances=req.federal_allowances, federal_extra_withholding=req.federal_extra_withholding,
        state_code=(req.state_code or "").upper() or None, state_allowances=req.state_allowances,
        state_extra_withholding=req.state_extra_withholding,
        city_code=(req.city_code or "").strip().lower() or None, city_resident=req.city_resident,
        pay_basis=req.pay_basis, hourly_rate=req.hourly_rate, salary_annual=req.salary_annual,
        commission_rate=req.commission_rate, ssn_last4=(req.ssn_last4 or "").strip() or None,
        email=(req.email or "").strip() or None, notes=req.notes, active=True,
    )

    if existing:
        set_clause = ", ".join(f"{k}=%s" for k in fields)
        cur.execute(
            f"UPDATE employees SET {set_clause}, updated_at=NOW() WHERE technician_id=%s",
            [*fields.values(), req.technician_id]
        )
    else:
        keys = ", ".join(["technician_id"] + list(fields.keys()))
        vals = ", ".join(["%s"] * (len(fields) + 1))
        cur.execute(
            f"INSERT INTO employees ({keys}) VALUES ({vals})",
            [req.technician_id] + list(fields.values())
        )

    conn.commit(); cur.close(); conn.close()
    return {"success": True}


class PeriodRequest(BaseModel):
    period_start: str
    period_end: str


@payroll_router.get("/run/default-period")
def default_period(request: Request):
    require_login(request)
    check_module(request, "payroll")
    ps, pe = _prior_week()
    return {"period_start": ps.isoformat(), "period_end": pe.isoformat()}


@payroll_router.post("/run/preview")
def run_preview(req: PeriodRequest, request: Request):
    require_login(request)
    check_module(request, "payroll")
    from Financial.tools.payroll.tax_tables import (
        calc_federal_withholding, calc_state_withholding, calc_state_sdi,
        calc_fica, calc_futa, calc_suta, effective_state, calc_city_withholding,
    )

    period_start = date.fromisoformat(req.period_start)
    period_end = date.fromisoformat(req.period_end)
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
        basis = emp["pay_basis"]
        reg = ot = comm = hours = 0.0
        hr = float(emp["hourly_rate"] or 0)

        if basis in ("hourly", "hybrid"):
            try:
                cur.execute("""
                    SELECT COALESCE(SUM(hours_worked),0) AS h FROM time_entries
                    WHERE technician_id=%s AND clock_in::date BETWEEN %s AND %s AND hours_worked IS NOT NULL
                """, (tech_id, period_start, period_end))
                hours = float(cur.fetchone()["h"])
            except Exception:
                hours = 0.0
            reg = min(hours, 40.0) * hr
            ot = max(hours - 40.0, 0.0) * hr * 1.5

        if basis == "salary":
            reg = float(emp["salary_annual"] or 0) / PAY_PERIODS

        if basis in ("commission", "hybrid"):
            cur.execute("""
                SELECT COALESCE(SUM(total),0) AS r FROM pos_transactions
                WHERE technician_id=%s AND created_at::date BETWEEN %s AND %s
                  AND status='completed' AND total > 0
            """, (tech_id, period_start, period_end))
            rev = float(cur.fetchone()["r"])
            comm = rev * float(emp["commission_rate"] or 0.45)

        gross = round(reg + ot + comm, 2)
        if gross == 0:
            continue

        ytd = _ytd(cur, tech_id, period_start)

        if emp["employee_type"] == "w2":
            state = effective_state(emp["state_code"], employer_state)
            fica = calc_fica(gross, ytd["ytd_gross"])
            fed = calc_federal_withholding(gross, emp["filing_status"],
                       emp["federal_allowances"] or 0, emp["federal_extra_withholding"] or 0, PAY_PERIODS)
            st_wh = calc_state_withholding(gross, state, emp["filing_status"],
                       emp["state_allowances"] or 0, emp["state_extra_withholding"] or 0, PAY_PERIODS)
            sdi = calc_state_sdi(gross, state, ytd["ytd_sdi"])
            city_tax = calc_city_withholding(gross, state, emp.get("city_code"), emp.get("city_resident", True))
            futa = calc_futa(gross, ytd["ytd_gross"])
            suta = calc_suta(gross, ytd["ytd_gross"], state, emp.get("suta_rate"))

            total_ded = round(fed + fica["employee_ss"] + fica["employee_medicare"]
                              + fica["additional_medicare"] + st_wh + sdi + city_tax, 2)
            total_er = round(fica["employer_ss"] + fica["employer_medicare"] + futa + suta, 2)
            net = round(gross - total_ded, 2)

            taxes = dict(
                federal=fed, ss_emp=fica["employee_ss"], med_emp=fica["employee_medicare"],
                add_med=fica["additional_medicare"], state_wh=st_wh, sdi=sdi, city_tax=city_tax,
                er_ss=fica["employer_ss"], er_med=fica["employer_medicare"],
                futa=futa, suta=suta, total_ded=total_ded, total_er=total_er,
            )
        else:
            taxes = {k: 0.0 for k in ["federal","ss_emp","med_emp","add_med","state_wh",
                                        "sdi","city_tax","er_ss","er_med","futa","suta",
                                        "total_ded","total_er"]}
            net = gross

        entries.append({
            "tech_id": tech_id, "name": emp["name"], "type": emp["employee_type"],
            "basis": basis, "hours": hours, "rate": hr, "reg": round(reg, 2), "ot": round(ot, 2),
            "comm": round(comm, 2), "gross": gross, "net": net,
            "taxes": {k: round(float(v), 2) for k, v in taxes.items()},
            "ytd_gross": ytd["ytd_gross"],
        })

    cur.close(); conn.close()

    return {
        "success": True, "entries": entries,
        "total_gross": round(sum(e["gross"] for e in entries), 2),
        "total_net": round(sum(e["net"] for e in entries), 2),
        "total_er_tax": round(sum(e["taxes"]["total_er"] for e in entries), 2),
        "period_start": period_start.isoformat(), "period_end": period_end.isoformat(),
    }


class RunSaveRequest(BaseModel):
    period_start: str
    period_end: str
    entries: list


@payroll_router.post("/run/save")
def run_save(req: RunSaveRequest, request: Request):
    require_login(request)
    check_module(request, "payroll")

    period_start = date.fromisoformat(req.period_start)
    period_end = date.fromisoformat(req.period_end)
    days_to_fri = (4 - period_end.weekday()) % 7 or 7
    pay_date = period_end + timedelta(days=days_to_fri)

    conn = get_db(); cur = conn.cursor()

    cur.execute("""
        SELECT id FROM payroll_runs
        WHERE pay_period_start=%s AND pay_period_end=%s AND status != 'void'
    """, (period_start, period_end))
    if cur.fetchone():
        cur.close(); conn.close()
        return {"success": False, "error": "A run for this period already exists."}

    total_gross = total_net = total_ded = total_er = 0.0

    cur.execute("""
        INSERT INTO payroll_runs (pay_period_start, pay_period_end, pay_date, status)
        VALUES (%s,%s,%s,'draft') RETURNING id
    """, (period_start, period_end, pay_date))
    run_id = cur.fetchone()["id"]

    for e in req.entries:
        tech_id = e["tech_id"]
        gross = e["gross"]
        taxes = e["taxes"]
        ytd = _ytd(cur, tech_id, period_start)
        net = round(gross - taxes.get("total_ded", 0), 2)

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
                %s,%s,%s, %s,%s,%s,%s,%s,%s, %s,%s,%s,%s,%s,%s,%s,
                %s,%s,%s, %s,%s,%s,%s,%s, %s, %s,%s,%s,%s,%s,%s,%s,%s
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
        total_gross += gross; total_net += net
        total_ded += taxes.get("total_ded",0); total_er += taxes.get("total_er",0)

    cur.execute("""
        UPDATE payroll_runs SET total_gross=%s, total_net=%s, total_employee_tax=%s, total_employer_tax=%s
        WHERE id=%s
    """, (round(total_gross,2), round(total_net,2), round(total_ded,2), round(total_er,2), run_id))
    conn.commit(); cur.close(); conn.close()
    return {"success": True, "run_id": run_id}


@payroll_router.get("/run/{run_id}/stubs")
def get_stubs(run_id: int, request: Request):
    require_login(request)
    check_module(request, "payroll")
    conn = get_db(); cur = conn.cursor()

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
    run_row = cur.fetchone()
    if not run_row:
        cur.close(); conn.close()
        raise HTTPException(status_code=404, detail="Run not found")
    run = dict(run_row)
    cur.close(); conn.close()

    return {"run": run, "entries": entries, "employer_state": os.getenv("EMPLOYER_STATE", "")}


@payroll_router.post("/run/{run_id}/approve")
def approve_run(run_id: int, request: Request):
    require_login(request)
    check_module(request, "payroll")
    conn = get_db(); cur = conn.cursor()
    cur.execute("UPDATE payroll_runs SET status='paid' WHERE id=%s", (run_id,))
    conn.commit(); cur.close(); conn.close()
    return {"success": True}


@payroll_router.post("/run/{run_id}/void")
def void_run(run_id: int, request: Request):
    require_login(request)
    check_module(request, "payroll")
    conn = get_db(); cur = conn.cursor()
    cur.execute("UPDATE payroll_runs SET status='void' WHERE id=%s", (run_id,))
    conn.commit(); cur.close(); conn.close()
    return {"success": True}


@payroll_router.get("/reports")
def reports(request: Request):
    require_login(request)
    check_module(request, "payroll")
    today = date.today()
    year = today.year
    deadlines = [
        {"name": f"Form 941 — Q1 {year}", "due": date(year,4,30).isoformat(), "form": "941"},
        {"name": f"Form 941 — Q2 {year}", "due": date(year,7,31).isoformat(), "form": "941"},
        {"name": f"Form 941 — Q3 {year}", "due": date(year,10,31).isoformat(), "form": "941"},
        {"name": f"Form 941 — Q4 {year}", "due": date(year+1,1,31).isoformat(), "form": "941"},
        {"name": f"Form 940 (FUTA) — {year}", "due": date(year+1,1,31).isoformat(), "form": "940"},
        {"name": f"W-2s to employees — {year}", "due": date(year+1,1,31).isoformat(), "form": "w2"},
        {"name": f"1099-NEC to contractors — {year}", "due": date(year+1,1,31).isoformat(), "form": "1099"},
    ]
    upcoming = [d for d in deadlines if date.fromisoformat(d["due"]) >= today]
    return {
        "deadlines": upcoming,
        "employer_ein": os.getenv("EMPLOYER_EIN", "(set EMPLOYER_EIN in .env)"),
    }
