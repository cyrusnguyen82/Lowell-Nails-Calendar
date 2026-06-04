"""
run_payroll.py

Run weekly payroll for all active employees and contractors.
Calculates gross pay, tax withholding, and net pay. Generates pay stubs.

Usage:
    python Financial/tools/payroll/run_payroll.py --list
    python Financial/tools/payroll/run_payroll.py --dry-run
    python Financial/tools/payroll/run_payroll.py --dry-run --week 2026-05-12
    python Financial/tools/payroll/run_payroll.py --run
    python Financial/tools/payroll/run_payroll.py --run --week 2026-05-12
    python Financial/tools/payroll/run_payroll.py --stubs --run-id 4
    python Financial/tools/payroll/run_payroll.py --approve --run-id 4
    python Financial/tools/payroll/run_payroll.py --void --run-id 4

Pay period defaults to the prior Monday–Sunday if --week is omitted.
"""

import os
import sys
import argparse
import logging
from datetime import date, timedelta, datetime, timezone
from zoneinfo import ZoneInfo
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

load_dotenv(os.path.join(ROOT, ".env"))

from Financial.tools.payroll.tax_tables import (
    calc_federal_withholding, calc_state_withholding, calc_state_sdi,
    calc_fica, calc_futa, calc_suta, effective_state, is_no_income_tax_state,
)

log = logging.getLogger("run_payroll")

BUSINESS      = os.getenv("BUSINESS_NAME", "Your Business")
EMPLOYER_STATE = os.getenv("EMPLOYER_STATE", "").upper()
TZ_NAME       = os.getenv("SCHEDULER_TIMEZONE", "America/Los_Angeles")
PAY_PERIODS   = 52  # weekly


def get_db():
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL not set in .env")
    return psycopg2.connect(url, cursor_factory=psycopg2.extras.RealDictCursor)


def fmt(n):
    return f"${float(n):>10,.2f}"


def fmt_inline(n):
    return f"${float(n):,.2f}"


def prior_week(ref: date = None) -> tuple[date, date]:
    today = ref or date.today()
    monday = today - timedelta(days=today.weekday() + 7)
    return monday, monday + timedelta(days=6)


def pay_date_for(period_end: date) -> date:
    """Pay date = Friday of the week after the pay period ends."""
    days_to_friday = (4 - period_end.weekday()) % 7
    if days_to_friday == 0:
        days_to_friday = 7
    return period_end + timedelta(days=days_to_friday)


# ── YTD helpers ───────────────────────────────────────────────────────────────

def get_ytd(cur, tech_id: int, period_start: date) -> dict:
    """Sum all approved/paid payroll entries for this technician prior to this period."""
    year_start = date(period_start.year, 1, 1)
    cur.execute("""
        SELECT
            COALESCE(SUM(pe.gross_pay), 0)          AS ytd_gross,
            COALESCE(SUM(pe.federal_income_tax), 0) AS ytd_federal,
            COALESCE(SUM(pe.social_security_tax + pe.additional_medicare), 0) AS ytd_ss,
            COALESCE(SUM(pe.social_security_tax), 0) AS ytd_ss_tax,
            COALESCE(SUM(pe.medicare_tax + pe.additional_medicare), 0) AS ytd_medicare,
            COALESCE(SUM(pe.state_income_tax), 0)   AS ytd_state,
            COALESCE(SUM(pe.state_sdi), 0)          AS ytd_sdi
        FROM payroll_entries pe
        JOIN payroll_runs pr ON pr.id = pe.run_id
        WHERE pe.technician_id = %s
          AND pr.pay_period_start >= %s
          AND pr.pay_period_start < %s
          AND pr.status IN ('approved', 'paid')
    """, (tech_id, year_start, period_start))
    row = cur.fetchone()
    return {k: float(v) for k, v in row.items()} if row else {
        "ytd_gross": 0.0, "ytd_federal": 0.0, "ytd_ss": 0.0,
        "ytd_ss_tax": 0.0, "ytd_medicare": 0.0, "ytd_state": 0.0, "ytd_sdi": 0.0,
    }


# ── Gross pay calculation ─────────────────────────────────────────────────────

def calc_gross(emp: dict, cur, period_start: date, period_end: date) -> dict:
    """Return gross pay breakdown for one employee for the pay period."""
    basis = emp["pay_basis"]
    tech_id = emp["technician_id"]

    regular_pay   = 0.0
    overtime_pay  = 0.0
    commission_pay = 0.0
    hours_worked  = 0.0
    hourly_rate   = float(emp["hourly_rate"] or 0)

    if basis in ("hourly", "hybrid"):
        # Pull hours from time_entries if the table exists
        try:
            cur.execute("""
                SELECT COALESCE(SUM(hours_worked), 0) AS total_hours
                FROM time_entries
                WHERE technician_id = %s
                  AND clock_in::date BETWEEN %s AND %s
                  AND hours_worked IS NOT NULL
            """, (tech_id, period_start, period_end))
            hours_worked = float(cur.fetchone()["total_hours"])
        except Exception:
            hours_worked = 0.0

        reg_hours = min(hours_worked, 40.0)
        ot_hours  = max(hours_worked - 40.0, 0.0)
        regular_pay  = reg_hours * hourly_rate
        overtime_pay = ot_hours  * hourly_rate * 1.5

    if basis == "salary":
        regular_pay = float(emp["salary_annual"] or 0) / PAY_PERIODS

    if basis in ("commission", "hybrid"):
        try:
            cur.execute("""
                SELECT COALESCE(SUM(total), 0) AS rev
                FROM transactions
                WHERE technician_id = %s
                  AND created_at::date BETWEEN %s AND %s
                  AND status IN ('completed', 'paid', 'done')
                  AND total > 0
            """, (tech_id, period_start, period_end))
            revenue = float(cur.fetchone()["rev"])
            commission_pay = revenue * float(emp["commission_rate"] or 0.45)
        except Exception:
            commission_pay = 0.0

    gross = regular_pay + overtime_pay + commission_pay
    return {
        "hours_worked":   round(hours_worked, 2),
        "hourly_rate":    hourly_rate,
        "regular_pay":    round(regular_pay, 2),
        "overtime_pay":   round(overtime_pay, 2),
        "commission_pay": round(commission_pay, 2),
        "gross_pay":      round(gross, 2),
    }


# ── Tax calculation ───────────────────────────────────────────────────────────

def calc_w2_taxes(emp: dict, gross_pay: float, ytd: dict) -> dict:
    state = effective_state(emp["state_code"], EMPLOYER_STATE)
    ytd_gross = ytd["ytd_gross"]

    fica = calc_fica(gross_pay, ytd_gross)
    fed  = calc_federal_withholding(
        gross_pay, emp["filing_status"],
        emp["federal_allowances"] or 0,
        emp["federal_extra_withholding"] or 0.0,
        PAY_PERIODS,
    )
    state_wh = calc_state_withholding(
        gross_pay, state, emp["filing_status"],
        emp["state_allowances"] or 0,
        emp["state_extra_withholding"] or 0.0,
        PAY_PERIODS,
    )
    sdi = calc_state_sdi(gross_pay, state, ytd.get("ytd_sdi", 0.0))

    futa = calc_futa(gross_pay, ytd_gross)
    suta = calc_suta(gross_pay, ytd_gross, state, emp.get("suta_rate"))

    total_emp_deductions = (
        fed
        + fica["employee_ss"]
        + fica["employee_medicare"]
        + fica["additional_medicare"]
        + state_wh
        + sdi
        + (emp["federal_extra_withholding"] or 0.0)
        + (emp["state_extra_withholding"] or 0.0)
    )
    # extra_wh already included in fed/state_wh from calc functions — avoid double-counting
    total_emp_deductions = (
        fed
        + fica["employee_ss"]
        + fica["employee_medicare"]
        + fica["additional_medicare"]
        + state_wh
        + sdi
    )
    total_er_taxes = (
        fica["employer_ss"]
        + fica["employer_medicare"]
        + futa
        + suta
    )

    return {
        "federal_income_tax":   fed,
        "social_security_tax":  fica["employee_ss"],
        "medicare_tax":         fica["employee_medicare"],
        "additional_medicare":  fica["additional_medicare"],
        "state_income_tax":     state_wh,
        "state_sdi":            sdi,
        "federal_extra_wh":     emp["federal_extra_withholding"] or 0.0,
        "state_extra_wh":       emp["state_extra_withholding"] or 0.0,
        "total_deductions":     round(total_emp_deductions, 2),
        "employer_ss":          fica["employer_ss"],
        "employer_medicare":    fica["employer_medicare"],
        "employer_futa":        futa,
        "employer_suta":        suta,
        "total_employer_tax":   round(total_er_taxes, 2),
    }


# ── Pay stub builder ──────────────────────────────────────────────────────────

def build_pay_stub(emp_name: str, emp_record: dict, gross_data: dict,
                   tax_data: dict, ytd: dict,
                   period_start: date, period_end: date, pay_date: date,
                   net_pay: float, emp_type: str) -> str:

    SEP = "═" * 58
    sep = "─" * 58
    lines = [SEP]
    lines.append(f"  {BUSINESS}".center(58))
    if emp_type == "contractor":
        lines.append("  CONTRACTOR PAYMENT STUB".center(58))
    else:
        lines.append("  PAY STUB — CONFIDENTIAL".center(58))
    lines.append(SEP)

    ssn = f"***-**-{emp_record['ssn_last4']}" if emp_record.get("ssn_last4") else "on file"
    lines.append(f"  Employee:  {emp_name:<28}  {('SSN: ' + ssn) if emp_type == 'w2' else ('EIN: ' + (emp_record.get('ein') or 'on file'))}")
    lines.append(f"  Period:    {period_start.strftime('%b %d')} – {period_end.strftime('%b %d, %Y'):<17}  Pay Date: {pay_date.strftime('%b %d, %Y')}")
    lines.append(f"  Type:      {'W-2 Employee' if emp_type == 'w2' else '1099 Contractor'}")
    lines.append(sep)

    # Earnings
    lines.append(f"\n  EARNINGS")
    basis = emp_record.get("pay_basis", "")
    if gross_data["regular_pay"] > 0:
        hrs = gross_data["hours_worked"]
        rate = gross_data["hourly_rate"]
        if basis == "salary":
            lines.append(f"  {'Salary':<40}{fmt(gross_data['regular_pay'])}")
        else:
            reg_hrs = min(hrs, 40.0)
            lines.append(f"  {f'Regular ({reg_hrs:.2f} hrs × ${rate:.2f}/hr)':<40}{fmt(gross_data['regular_pay'])}")
    if gross_data["overtime_pay"] > 0:
        ot_hrs = max(gross_data["hours_worked"] - 40.0, 0.0)
        rate = gross_data["hourly_rate"]
        lines.append(f"  {f'Overtime ({ot_hrs:.2f} hrs × ${rate * 1.5:.2f}/hr)':<40}{fmt(gross_data['overtime_pay'])}")
    if gross_data["commission_pay"] > 0:
        rate_pct = float(emp_record.get("commission_rate") or 0.45) * 100
        lines.append(f"  {f'Commission ({rate_pct:.0f}%)':<40}{fmt(gross_data['commission_pay'])}")

    lines.append(f"  {sep}")
    lines.append(f"  {'Gross Pay':<40}{fmt(gross_data['gross_pay'])}")

    if emp_type == "w2":
        # Deductions
        lines.append(f"\n  DEDUCTIONS")
        state = effective_state(emp_record.get("state_code"), EMPLOYER_STATE)
        filing = emp_record.get("filing_status", "single").replace("_", " ").title()
        allow = emp_record.get("federal_allowances", 0)

        if tax_data["federal_income_tax"] > 0:
            lines.append(f"  {f'Federal Income Tax ({filing}, {allow} allow.)':<40}{fmt(tax_data['federal_income_tax'])}")
        if tax_data["social_security_tax"] > 0:
            lines.append(f"  {'Social Security (6.2%)':<40}{fmt(tax_data['social_security_tax'])}")
        if tax_data["medicare_tax"] > 0:
            lines.append(f"  {'Medicare (1.45%)':<40}{fmt(tax_data['medicare_tax'])}")
        if tax_data["additional_medicare"] > 0:
            lines.append(f"  {'Additional Medicare (0.9%)':<40}{fmt(tax_data['additional_medicare'])}")
        if tax_data["state_income_tax"] > 0 and not is_no_income_tax_state(state):
            lines.append(f"  {f'{state} State Income Tax':<40}{fmt(tax_data['state_income_tax'])}")
        if tax_data["state_sdi"] > 0:
            lines.append(f"  {f'{state} SDI':<40}{fmt(tax_data['state_sdi'])}")

        lines.append(f"  {sep}")
        lines.append(f"  {'Total Deductions':<40}{fmt(tax_data['total_deductions'])}")

        lines.append(f"\n  {'NET PAY':<40}{fmt(net_pay)}")

        # Employer section (informational)
        lines.append(f"\n  EMPLOYER TAXES (not deducted from your pay)")
        if tax_data["employer_ss"] > 0:
            lines.append(f"  {'Social Security (6.2%)':<40}{fmt(tax_data['employer_ss'])}")
        if tax_data["employer_medicare"] > 0:
            lines.append(f"  {'Medicare (1.45%)':<40}{fmt(tax_data['employer_medicare'])}")
        if tax_data["employer_futa"] > 0:
            lines.append(f"  {'FUTA':<40}{fmt(tax_data['employer_futa'])}")
        if tax_data["employer_suta"] > 0:
            lines.append(f"  {f'{state} SUTA':<40}{fmt(tax_data['employer_suta'])}")
        lines.append(f"  {sep}")
        lines.append(f"  {'Total Employer Taxes':<40}{fmt(tax_data['total_employer_tax'])}")

        # YTD
        ytd_new_gross   = ytd["ytd_gross"]   + gross_data["gross_pay"]
        ytd_new_federal = ytd["ytd_federal"] + tax_data["federal_income_tax"]
        ytd_new_ss      = ytd["ytd_ss_tax"]  + tax_data["social_security_tax"]
        ytd_new_med     = ytd["ytd_medicare"] + tax_data["medicare_tax"]
        ytd_new_state   = ytd["ytd_state"]   + tax_data["state_income_tax"]
        lines.append(f"\n  YEAR-TO-DATE")
        lines.append(f"  {'Gross:':<20}{fmt_inline(ytd_new_gross):<16}  {'Federal Tax:':<16}{fmt_inline(ytd_new_federal)}")
        lines.append(f"  {'SS Wages:':<20}{fmt_inline(ytd_new_gross):<16}  {'SS Tax:':<16}{fmt_inline(ytd_new_ss)}")
        lines.append(f"  {'Medicare Tax:':<20}{fmt_inline(ytd_new_med):<16}  {'State Tax:':<16}{fmt_inline(ytd_new_state)}")

    else:
        # Contractor
        lines.append(f"\n  {'TOTAL PAYMENT':<40}{fmt(net_pay)}")
        lines.append(f"\n  Note: As an independent contractor, you are responsible")
        lines.append(f"  for self-employment taxes (15.3%) on this income.")
        ytd_new = ytd["ytd_gross"] + gross_data["gross_pay"]
        lines.append(f"\n  YTD Payments (this calendar year): {fmt_inline(ytd_new)}")

    lines.append(SEP + "\n")
    return "\n".join(lines)


# ── Core payroll run ──────────────────────────────────────────────────────────

def compute_run(cur, period_start: date, period_end: date) -> list:
    """Compute payroll for all active employees. Returns list of entry dicts."""
    cur.execute("""
        SELECT e.*, t.first_name || ' ' || t.last_name AS name
        FROM employees e
        JOIN technicians t ON t.id = e.technician_id
        WHERE e.active = TRUE
        ORDER BY t.first_name, t.last_name
    """)
    employees = cur.fetchall()
    if not employees:
        log.warning("No active employees found.")
        return []

    entries = []
    for emp in employees:
        gross_data = calc_gross(emp, cur, period_start, period_end)
        gross = gross_data["gross_pay"]

        if gross == 0:
            log.info(f"  {emp['name']}: $0 gross — skipping")
            continue

        ytd = get_ytd(cur, emp["technician_id"], period_start)

        if emp["employee_type"] == "w2":
            taxes = calc_w2_taxes(emp, gross, ytd)
            net = round(gross - taxes["total_deductions"], 2)
        else:
            taxes = {k: 0.0 for k in [
                "federal_income_tax", "social_security_tax", "medicare_tax",
                "additional_medicare", "state_income_tax", "state_sdi",
                "federal_extra_wh", "state_extra_wh", "total_deductions",
                "employer_ss", "employer_medicare", "employer_futa",
                "employer_suta", "total_employer_tax",
            ]}
            net = gross

        entries.append({
            "emp": dict(emp),
            "gross_data": gross_data,
            "taxes": taxes,
            "ytd": ytd,
            "net_pay": net,
        })

    return entries


def print_run_summary(entries: list, period_start: date, period_end: date):
    pay_date = pay_date_for(period_end)
    print(f"\n{'═'*70}")
    print(f"  PAYROLL PREVIEW — {period_start.strftime('%b %d')} to {period_end.strftime('%b %d, %Y')}")
    print(f"  Pay Date: {pay_date.strftime('%B %d, %Y')}   ({BUSINESS})")
    print(f"{'═'*70}")
    print(f"  {'Name':<22} {'Type':<12} {'Gross':>10} {'Deductions':>12} {'Net Pay':>10} {'Er.Taxes':>10}")
    print(f"  {'─'*22} {'─'*12} {'─'*10} {'─'*12} {'─'*10} {'─'*10}")

    total_gross = total_net = total_emp_tax = total_er_tax = 0.0
    for e in entries:
        g  = e["gross_data"]["gross_pay"]
        d  = e["taxes"]["total_deductions"]
        n  = e["net_pay"]
        et = e["taxes"]["total_employer_tax"]
        emp_type = "W-2" if e["emp"]["employee_type"] == "w2" else "Contractor"
        print(f"  {e['emp']['name']:<22} {emp_type:<12} {fmt_inline(g):>10} {fmt_inline(d):>12} {fmt_inline(n):>10} {fmt_inline(et):>10}")
        total_gross  += g
        total_net    += n
        total_emp_tax += d
        total_er_tax  += et

    print(f"  {'─'*70}")
    print(f"  {'TOTAL':<22} {'':>12} {fmt_inline(total_gross):>10} {fmt_inline(total_emp_tax):>12} {fmt_inline(total_net):>10} {fmt_inline(total_er_tax):>10}")
    print(f"\n  Total liability (gross + employer taxes): {fmt_inline(total_gross + total_er_tax)}")
    print(f"{'═'*70}\n")
    return total_gross, total_net, total_emp_tax, total_er_tax


# ── CLI commands ──────────────────────────────────────────────────────────────

def cmd_list_runs(cur):
    cur.execute("""
        SELECT id, pay_period_start, pay_period_end, pay_date,
               status, total_gross, total_net, total_employer_tax
        FROM payroll_runs
        ORDER BY pay_period_start DESC
        LIMIT 20
    """)
    rows = cur.fetchall()
    if not rows:
        print("No payroll runs found.")
        return
    print(f"\n  {'ID':<5} {'Period':<24} {'Pay Date':<14} {'Status':<12} {'Gross':>10} {'Net':>10}")
    print("  " + "─" * 78)
    for r in rows:
        period = f"{r['pay_period_start'].strftime('%b %d')} – {r['pay_period_end'].strftime('%b %d, %Y')}"
        print(f"  {r['id']:<5} {period:<24} {r['pay_date'].strftime('%b %d, %Y'):<14} {r['status']:<12} {fmt_inline(r['total_gross']):>10} {fmt_inline(r['total_net']):>10}")
    print()


def cmd_dry_run(cur, period_start: date, period_end: date):
    entries = compute_run(cur, period_start, period_end)
    if not entries:
        print("No payroll to process.")
        return
    print_run_summary(entries, period_start, period_end)
    print("  [DRY RUN] No data was saved.\n")


def cmd_run(cur, conn, period_start: date, period_end: date):
    # Check for duplicate run
    cur.execute("""
        SELECT id FROM payroll_runs
        WHERE pay_period_start = %s AND pay_period_end = %s AND status != 'void'
    """, (period_start, period_end))
    existing = cur.fetchone()
    if existing:
        print(f"A payroll run already exists for this period (run_id {existing['id']}). Use --void to void it first.")
        return

    entries = compute_run(cur, period_start, period_end)
    if not entries:
        print("No payroll to process.")
        return

    total_gross, total_net, total_emp_tax, total_er_tax = print_run_summary(entries, period_start, period_end)

    confirm = input("Confirm and save this payroll run? [yes/no]: ").strip().lower()
    if confirm != "yes":
        print("Cancelled.")
        return

    pay_date = pay_date_for(period_end)

    # Insert run header
    cur.execute("""
        INSERT INTO payroll_runs
            (pay_period_start, pay_period_end, pay_date, status,
             total_gross, total_net, total_employee_tax, total_employer_tax)
        VALUES (%s, %s, %s, 'draft', %s, %s, %s, %s)
        RETURNING id
    """, (period_start, period_end, pay_date,
          total_gross, total_net, round(total_emp_tax, 2), round(total_er_tax, 2)))
    run_id = cur.fetchone()["id"]

    # Insert entries
    for e in entries:
        g = e["gross_data"]
        t = e["taxes"]
        ytd = e["ytd"]
        cur.execute("""
            INSERT INTO payroll_entries (
                run_id, technician_id, employee_type,
                hours_worked, hourly_rate, regular_pay, overtime_pay, commission_pay, gross_pay,
                federal_income_tax, social_security_tax, medicare_tax, additional_medicare,
                state_income_tax, state_sdi, federal_extra_wh, state_extra_wh, total_deductions,
                employer_ss, employer_medicare, employer_futa, employer_suta, total_employer_tax,
                net_pay,
                ytd_gross, ytd_federal_tax, ytd_ss_wages, ytd_ss_tax, ytd_medicare_tax, ytd_state_tax, ytd_sdi
            ) VALUES (
                %s,%s,%s,
                %s,%s,%s,%s,%s,%s,
                %s,%s,%s,%s,
                %s,%s,%s,%s,%s,
                %s,%s,%s,%s,%s,
                %s,
                %s,%s,%s,%s,%s,%s,%s
            )
        """, (
            run_id, e["emp"]["technician_id"], e["emp"]["employee_type"],
            g["hours_worked"], g["hourly_rate"], g["regular_pay"], g["overtime_pay"], g["commission_pay"], g["gross_pay"],
            t["federal_income_tax"], t["social_security_tax"], t["medicare_tax"], t["additional_medicare"],
            t["state_income_tax"], t["state_sdi"], t["federal_extra_wh"], t["state_extra_wh"], t["total_deductions"],
            t["employer_ss"], t["employer_medicare"], t["employer_futa"], t["employer_suta"], t["total_employer_tax"],
            e["net_pay"],
            ytd["ytd_gross"], ytd["ytd_federal"], ytd["ytd_gross"], ytd["ytd_ss_tax"],
            ytd["ytd_medicare"], ytd["ytd_state"], ytd["ytd_sdi"],
        ))

    conn.commit()
    print(f"  Payroll run #{run_id} saved as DRAFT.")
    print(f"  Use --approve --run-id {run_id} when payments are issued.")
    print(f"  Use --stubs --run-id {run_id} to print pay stubs.\n")


def cmd_stubs(cur, run_id: int):
    cur.execute("""
        SELECT pe.*, t.first_name || ' ' || t.last_name AS name,
               pr.pay_period_start, pr.pay_period_end, pr.pay_date
        FROM payroll_entries pe
        JOIN technicians t ON t.id = pe.technician_id
        JOIN payroll_runs pr ON pr.id = pe.run_id
        WHERE pe.run_id = %s
        ORDER BY t.first_name
    """, (run_id,))
    rows = cur.fetchall()
    if not rows:
        print(f"No entries for run_id {run_id}")
        return

    # We need the employee record too for filing status etc.
    for row in rows:
        cur.execute("SELECT * FROM employees WHERE technician_id = %s", (row["technician_id"],))
        emp_rec = cur.fetchone() or {}

        gross_data = {
            "hours_worked": float(row["hours_worked"]),
            "hourly_rate":  float(row["hourly_rate"]),
            "regular_pay":  float(row["regular_pay"]),
            "overtime_pay": float(row["overtime_pay"]),
            "commission_pay": float(row["commission_pay"]),
            "gross_pay":    float(row["gross_pay"]),
        }
        tax_data = {
            "federal_income_tax":  float(row["federal_income_tax"]),
            "social_security_tax": float(row["social_security_tax"]),
            "medicare_tax":        float(row["medicare_tax"]),
            "additional_medicare": float(row["additional_medicare"]),
            "state_income_tax":    float(row["state_income_tax"]),
            "state_sdi":           float(row["state_sdi"]),
            "federal_extra_wh":    float(row["federal_extra_wh"]),
            "state_extra_wh":      float(row["state_extra_wh"]),
            "total_deductions":    float(row["total_deductions"]),
            "employer_ss":         float(row["employer_ss"]),
            "employer_medicare":   float(row["employer_medicare"]),
            "employer_futa":       float(row["employer_futa"]),
            "employer_suta":       float(row["employer_suta"]),
            "total_employer_tax":  float(row["total_employer_tax"]),
        }
        ytd = {
            "ytd_gross":    float(row["ytd_gross"]),
            "ytd_federal":  float(row["ytd_federal_tax"]),
            "ytd_ss_tax":   float(row["ytd_ss_tax"]),
            "ytd_medicare": float(row["ytd_medicare_tax"]),
            "ytd_state":    float(row["ytd_state_tax"]),
        }
        stub = build_pay_stub(
            row["name"], dict(emp_rec), gross_data, tax_data, ytd,
            row["pay_period_start"], row["pay_period_end"], row["pay_date"],
            float(row["net_pay"]), row["employee_type"],
        )
        print(stub)


def cmd_approve(cur, conn, run_id: int):
    cur.execute("SELECT status FROM payroll_runs WHERE id = %s", (run_id,))
    r = cur.fetchone()
    if not r:
        print(f"Run #{run_id} not found.")
        return
    if r["status"] == "paid":
        print(f"Run #{run_id} is already marked paid.")
        return
    cur.execute("UPDATE payroll_runs SET status = 'paid' WHERE id = %s", (run_id,))
    conn.commit()
    print(f"Run #{run_id} marked as PAID. YTD totals will now reflect this run.")


def cmd_void(cur, conn, run_id: int):
    cur.execute("SELECT status FROM payroll_runs WHERE id = %s", (run_id,))
    r = cur.fetchone()
    if not r:
        print(f"Run #{run_id} not found.")
        return
    confirm = input(f"Void run #{run_id}? This cannot be undone. [yes/no]: ")
    if confirm.strip().lower() != "yes":
        print("Cancelled.")
        return
    cur.execute("UPDATE payroll_runs SET status = 'void' WHERE id = %s", (run_id,))
    conn.commit()
    print(f"Run #{run_id} voided.")


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Weekly payroll runner.")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--list",      action="store_true",     help="List recent payroll runs")
    mode.add_argument("--dry-run",   action="store_true",     help="Preview without saving")
    mode.add_argument("--run",       action="store_true",     help="Run and save payroll")
    mode.add_argument("--stubs",     action="store_true",     help="Print pay stubs for a run")
    mode.add_argument("--approve",   action="store_true",     help="Mark a run as paid")
    mode.add_argument("--void",      action="store_true",     help="Void a run")

    parser.add_argument("--week",    type=str, metavar="YYYY-MM-DD",
                        help="Pay period start date (default: prior Monday)")
    parser.add_argument("--run-id",  type=int, metavar="ID",
                        help="Payroll run ID (required for --stubs, --approve, --void)")

    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    conn = get_db()
    cur  = conn.cursor()

    try:
        if args.list:
            cmd_list_runs(cur)

        elif args.dry_run or args.run:
            if args.week:
                ref = date.fromisoformat(args.week)
                period_start = ref - timedelta(days=ref.weekday())
            else:
                period_start, _ = prior_week()
            period_end = period_start + timedelta(days=6)

            if args.dry_run:
                cmd_dry_run(cur, period_start, period_end)
            else:
                cmd_run(cur, conn, period_start, period_end)

        elif args.stubs:
            if not args.run_id:
                print("--stubs requires --run-id N")
            else:
                cmd_stubs(cur, args.run_id)

        elif args.approve:
            if not args.run_id:
                print("--approve requires --run-id N")
            else:
                cmd_approve(cur, conn, args.run_id)

        elif args.void:
            if not args.run_id:
                print("--void requires --run-id N")
            else:
                cmd_void(cur, conn, args.run_id)
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
