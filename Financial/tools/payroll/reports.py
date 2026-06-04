"""
reports.py

Tax filing reports and deposit summaries for IRS Form 941, 940, W-2, and 1099-NEC.
All reports are informational — you still file and pay through IRS systems or payroll software.

Usage:
    python Financial/tools/payroll/reports.py --941 --quarter Q1 --year 2026
    python Financial/tools/payroll/reports.py --940 --year 2026
    python Financial/tools/payroll/reports.py --w2 --year 2026
    python Financial/tools/payroll/reports.py --1099 --year 2026
    python Financial/tools/payroll/reports.py --deposit-calendar --year 2026
    python Financial/tools/payroll/reports.py --suta --quarter Q1 --year 2026
    python Financial/tools/payroll/reports.py --941 --quarter Q1 --year 2026 --export

Filing deadlines (approximate — verify at IRS.gov each year):
  Form 941:  last day of month following end of quarter (April 30, July 31, Oct 31, Jan 31)
  Form 940:  January 31 of following year
  W-2:       January 31 of following year (to employees AND SSA)
  1099-NEC:  January 31 of following year (to contractors AND IRS)
  SUTA:      varies by state, typically last day of month following quarter end
"""

import os
import sys
import csv
import argparse
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

load_dotenv(os.path.join(ROOT, ".env"))

BUSINESS       = os.getenv("BUSINESS_NAME", "Your Business")
EMPLOYER_STATE = os.getenv("EMPLOYER_STATE", "").upper()
EIN            = os.getenv("EMPLOYER_EIN", "(set EMPLOYER_EIN in .env)")

EXPORT_DIR = os.path.join(ROOT, ".tmp")

QUARTERS = {
    "Q1": (date(2000, 1,  1), date(2000, 3,  31)),
    "Q2": (date(2000, 4,  1), date(2000, 6,  30)),
    "Q3": (date(2000, 7,  1), date(2000, 9,  30)),
    "Q4": (date(2000, 10, 1), date(2000, 12, 31)),
}

QUARTER_941_DUE = {
    "Q1": (4, 30), "Q2": (7, 31), "Q3": (10, 31), "Q4": (1, 31),
}


def get_db():
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL not set in .env")
    return psycopg2.connect(url, cursor_factory=psycopg2.extras.RealDictCursor)


def fmt(n):
    return f"${float(n):,.2f}"


def quarter_dates(q: str, year: int) -> tuple[date, date]:
    m_start, d_start = QUARTERS[q.upper()][0].month, QUARTERS[q.upper()][0].day
    m_end,   d_end   = QUARTERS[q.upper()][1].month, QUARTERS[q.upper()][1].day
    return date(year, m_start, d_start), date(year, m_end, d_end)


def year_dates(year: int) -> tuple[date, date]:
    return date(year, 1, 1), date(year, 12, 31)


def fetch_period_totals(cur, start: date, end: date, w2_only: bool = False) -> list:
    """Aggregate payroll by employee for a date range (paid runs only)."""
    type_filter = "AND pe.employee_type = 'w2'" if w2_only else ""
    cur.execute(f"""
        SELECT
            pe.technician_id,
            t.first_name || ' ' || t.last_name AS name,
            pe.employee_type,
            COALESCE(SUM(pe.gross_pay), 0)          AS gross,
            COALESCE(SUM(pe.federal_income_tax), 0) AS fed_wh,
            COALESCE(SUM(pe.social_security_tax), 0) AS ss_emp,
            COALESCE(SUM(pe.medicare_tax + pe.additional_medicare), 0) AS med_emp,
            COALESCE(SUM(pe.employer_ss), 0)         AS ss_er,
            COALESCE(SUM(pe.employer_medicare), 0)   AS med_er,
            COALESCE(SUM(pe.employer_futa), 0)       AS futa,
            COALESCE(SUM(pe.employer_suta), 0)       AS suta,
            COALESCE(SUM(pe.state_income_tax), 0)    AS state_wh,
            COALESCE(SUM(pe.state_sdi), 0)           AS sdi,
            COUNT(pe.id)                              AS run_count
        FROM payroll_entries pe
        JOIN technicians t ON t.id = pe.technician_id
        JOIN payroll_runs pr ON pr.id = pe.run_id
        WHERE pr.pay_period_start BETWEEN %s AND %s
          AND pr.status IN ('approved', 'paid')
          {type_filter}
        GROUP BY pe.technician_id, t.first_name, t.last_name, pe.employee_type
        ORDER BY name
    """, (start, end))
    return cur.fetchall()


# ── Form 941 ──────────────────────────────────────────────────────────────────

def report_941(cur, quarter: str, year: int, export: bool = False):
    start, end = quarter_dates(quarter, year)
    rows = fetch_period_totals(cur, start, end, w2_only=True)

    total_wages     = sum(float(r["gross"]) for r in rows)
    total_fed_wh    = sum(float(r["fed_wh"]) for r in rows)
    total_ss_emp    = sum(float(r["ss_emp"]) for r in rows)
    total_ss_er     = sum(float(r["ss_er"]) for r in rows)
    total_med_emp   = sum(float(r["med_emp"]) for r in rows)
    total_med_er    = sum(float(r["med_er"]) for r in rows)
    total_ss_both   = total_ss_emp + total_ss_er
    total_med_both  = total_med_emp + total_med_er
    total_tax       = total_fed_wh + total_ss_both + total_med_both

    due_m, due_d = QUARTER_941_DUE[quarter.upper()]
    due_year = year + 1 if quarter.upper() == "Q4" else year
    due_date = date(due_year, due_m, due_d)

    lines = []
    lines.append(f"{'═'*60}")
    lines.append(f"  FORM 941 SUMMARY — {quarter.upper()} {year}")
    lines.append(f"  {BUSINESS}   EIN: {EIN}")
    lines.append(f"  Period: {start} to {end}")
    lines.append(f"  Filing deadline: {due_date.strftime('%B %d, %Y')}")
    lines.append(f"{'═'*60}")

    lines.append(f"\n  LINE-BY-LINE REFERENCE (IRS Form 941)")
    lines.append(f"  {'Line 2  Total wages, tips, other comp':<45} {fmt(total_wages)}")
    lines.append(f"  {'Line 3  Federal income tax withheld':<45} {fmt(total_fed_wh)}")
    lines.append(f"  {'Line 5a SS wages (both employee + employer = 2x)':<45}")
    lines.append(f"           Employee SS tax ({fmt(total_ss_emp)}) + Employer ({fmt(total_ss_er)}) = {fmt(total_ss_both)}")
    lines.append(f"  {'Line 5c Medicare wages':<45}")
    lines.append(f"           Employee Medicare ({fmt(total_med_emp)}) + Employer ({fmt(total_med_er)}) = {fmt(total_med_both)}")
    lines.append(f"  {'Line 12 Total taxes before adjustments':<45} {fmt(total_tax)}")
    lines.append(f"\n  DEPOSIT SCHEDULE")
    if total_tax < 2500:
        lines.append(f"  Total tax < $2,500 → pay with Form 941 by {due_date.strftime('%b %d, %Y')}")
    elif total_tax < 50000:
        lines.append(f"  Monthly depositor: deposit by 15th of following month")
    else:
        lines.append(f"  Semi-weekly depositor: deposit within 3 banking days of payday")

    lines.append(f"\n  PER-EMPLOYEE DETAIL")
    lines.append(f"  {'Name':<24} {'Wages':>10} {'Fed WH':>9} {'SS':>9} {'Medicare':>10}")
    lines.append(f"  {'─'*24} {'─'*10} {'─'*9} {'─'*9} {'─'*10}")
    for r in rows:
        lines.append(
            f"  {r['name']:<24} {fmt(r['gross']):>10} {fmt(r['fed_wh']):>9} "
            f"{fmt(float(r['ss_emp'])+float(r['ss_er'])):>9} {fmt(float(r['med_emp'])+float(r['med_er'])):>10}"
        )
    lines.append(f"{'═'*60}")

    output = "\n".join(lines)
    print(output)

    if export:
        fname = os.path.join(EXPORT_DIR, f"941_{quarter.upper()}_{year}.txt")
        os.makedirs(EXPORT_DIR, exist_ok=True)
        with open(fname, "w") as f:
            f.write(output)
        print(f"\n  Exported to {fname}")


# ── Form 940 ──────────────────────────────────────────────────────────────────

def report_940(cur, year: int, export: bool = False):
    start, end = year_dates(year)
    rows = fetch_period_totals(cur, start, end, w2_only=True)

    total_wages = sum(float(r["gross"]) for r in rows)
    total_futa  = sum(float(r["futa"])  for r in rows)

    lines = []
    lines.append(f"{'═'*60}")
    lines.append(f"  FORM 940 SUMMARY — {year} (FUTA)")
    lines.append(f"  {BUSINESS}   EIN: {EIN}")
    lines.append(f"  Filing deadline: January 31, {year + 1}")
    lines.append(f"{'═'*60}")
    lines.append(f"\n  Total wages paid:          {fmt(total_wages)}")
    lines.append(f"  FUTA taxable wages (≤$7K per employee):  (see detail)")
    lines.append(f"  Total FUTA liability:      {fmt(total_futa)}")
    lines.append(f"\n  FUTA DEPOSIT RULE")
    lines.append(f"  If FUTA liability > $500 in any quarter → deposit by end of next month")
    lines.append(f"  If liability ≤ $500 for full year → pay with Form 940 by Jan 31, {year+1}")
    lines.append(f"\n  PER-EMPLOYEE (showing FUTA contributions)")
    lines.append(f"  {'Name':<28} {'Total Wages':>12} {'FUTA Paid':>12}")
    lines.append(f"  {'─'*28} {'─'*12} {'─'*12}")
    for r in rows:
        lines.append(f"  {r['name']:<28} {fmt(r['gross']):>12} {fmt(r['futa']):>12}")
    lines.append(f"{'═'*60}")

    output = "\n".join(lines)
    print(output)

    if export:
        fname = os.path.join(EXPORT_DIR, f"940_{year}.txt")
        os.makedirs(EXPORT_DIR, exist_ok=True)
        with open(fname, "w") as f:
            f.write(output)
        print(f"\n  Exported to {fname}")


# ── W-2 Prep ──────────────────────────────────────────────────────────────────

def report_w2(cur, year: int, export: bool = False):
    start, end = year_dates(year)
    rows = fetch_period_totals(cur, start, end, w2_only=True)

    lines = []
    lines.append(f"{'═'*70}")
    lines.append(f"  W-2 PREPARATION DATA — Tax Year {year}")
    lines.append(f"  {BUSINESS}   EIN: {EIN}")
    lines.append(f"  Furnish to employees AND file with SSA by January 31, {year+1}")
    lines.append(f"{'═'*70}")
    lines.append(f"\n  {'Name':<24} {'Box1 Wages':>12} {'Box2 FedWH':>12} {'Box4 SSWH':>10} {'Box6 MedWH':>10} {'Box16 StateW':>12} {'Box17 StWH':>10}")
    lines.append(f"  {'─'*24} {'─'*12} {'─'*12} {'─'*10} {'─'*10} {'─'*12} {'─'*10}")

    csv_rows = []
    for r in rows:
        lines.append(
            f"  {r['name']:<24} {fmt(r['gross']):>12} {fmt(r['fed_wh']):>12} "
            f"{fmt(r['ss_emp']):>10} {fmt(r['med_emp']):>10} {fmt(r['gross']):>12} {fmt(r['state_wh']):>10}"
        )
        csv_rows.append({
            "name": r["name"],
            "box1_wages": round(float(r["gross"]), 2),
            "box2_fed_wh": round(float(r["fed_wh"]), 2),
            "box3_ss_wages": round(float(r["gross"]), 2),
            "box4_ss_wh": round(float(r["ss_emp"]), 2),
            "box5_medicare_wages": round(float(r["gross"]), 2),
            "box6_medicare_wh": round(float(r["med_emp"]), 2),
            "box16_state_wages": round(float(r["gross"]), 2),
            "box17_state_wh": round(float(r["state_wh"]), 2),
            "state": EMPLOYER_STATE,
        })

    lines.append(f"\n  IMPORTANT: Verify these numbers match your payroll software.")
    lines.append(f"  Box 1 should exclude pre-tax benefits (health insurance, 401k, FSA).")
    lines.append(f"  File online at: https://www.ssa.gov/employer/bsovs.htm (Business Services Online)")
    lines.append(f"{'═'*70}")

    output = "\n".join(lines)
    print(output)

    if export:
        fname = os.path.join(EXPORT_DIR, f"w2_prep_{year}.csv")
        os.makedirs(EXPORT_DIR, exist_ok=True)
        with open(fname, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=csv_rows[0].keys())
            writer.writeheader()
            writer.writerows(csv_rows)
        print(f"\n  Exported to {fname}")


# ── 1099-NEC Prep ─────────────────────────────────────────────────────────────

def report_1099(cur, year: int, export: bool = False):
    start, end = year_dates(year)
    rows = fetch_period_totals(cur, start, end, w2_only=False)
    contractors = [r for r in rows if r["employee_type"] == "contractor"]

    lines = []
    lines.append(f"{'═'*60}")
    lines.append(f"  1099-NEC PREPARATION DATA — Tax Year {year}")
    lines.append(f"  {BUSINESS}   EIN: {EIN}")
    lines.append(f"  Furnish to contractors AND file with IRS by January 31, {year+1}")
    lines.append(f"  Only required if total payments ≥ $600")
    lines.append(f"{'═'*60}")

    if not contractors:
        lines.append(f"\n  No contractor payments found for {year}.")
        lines.append(f"{'═'*60}")
        print("\n".join(lines))
        return

    csv_rows = []
    lines.append(f"\n  {'Name':<30} {'NEC Amount (Box 1)':>20} {'Issue 1099?':>12}")
    lines.append(f"  {'─'*30} {'─'*20} {'─'*12}")
    for r in contractors:
        amount = float(r["gross"])
        issue = "YES" if amount >= 600 else "no (under $600)"
        lines.append(f"  {r['name']:<30} {fmt(amount):>20} {issue:>12}")
        if amount >= 600:
            csv_rows.append({"name": r["name"], "nec_box1_amount": round(amount, 2)})

    lines.append(f"\n  Get each contractor's W-9 before paying (TIN/SSN required for 1099).")
    lines.append(f"  File at: https://www.irs.gov/filing/e-file-forms-1099-with-iris")
    lines.append(f"{'═'*60}")

    output = "\n".join(lines)
    print(output)

    if export and csv_rows:
        fname = os.path.join(EXPORT_DIR, f"1099_nec_{year}.csv")
        os.makedirs(EXPORT_DIR, exist_ok=True)
        with open(fname, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=csv_rows[0].keys())
            writer.writeheader()
            writer.writerows(csv_rows)
        print(f"\n  Exported to {fname}")


# ── SUTA Quarterly ────────────────────────────────────────────────────────────

def report_suta(cur, quarter: str, year: int, export: bool = False):
    start, end = quarter_dates(quarter, year)
    rows = fetch_period_totals(cur, start, end, w2_only=True)

    total_suta = sum(float(r["suta"]) for r in rows)
    state = EMPLOYER_STATE or "your state"
    due_m, due_d = QUARTER_941_DUE[quarter.upper()]
    due_year = year + 1 if quarter.upper() == "Q4" else year
    due_date = date(due_year, due_m, due_d)

    lines = []
    lines.append(f"{'═'*60}")
    lines.append(f"  {state} SUTA QUARTERLY SUMMARY — {quarter.upper()} {year}")
    lines.append(f"  {BUSINESS}   EIN: {EIN}")
    lines.append(f"  Approximate filing deadline: {due_date.strftime('%B %d, %Y')}")
    lines.append(f"  File at your state unemployment agency website")
    lines.append(f"{'═'*60}")
    lines.append(f"\n  {'Name':<30} {'Taxable Wages':>14} {'SUTA Paid':>12}")
    lines.append(f"  {'─'*30} {'─'*14} {'─'*12}")
    for r in rows:
        lines.append(f"  {r['name']:<30} {fmt(r['gross']):>14} {fmt(r['suta']):>12}")
    lines.append(f"  {'─'*30} {'─'*14} {'─'*12}")
    lines.append(f"  {'TOTAL':<30} {'':>14} {fmt(total_suta):>12}")
    lines.append(f"\n  NOTE: SUTA is an employer-only tax. Never deduct from employee pay.")
    lines.append(f"{'═'*60}")

    print("\n".join(lines))


# ── Deposit calendar ──────────────────────────────────────────────────────────

def report_deposit_calendar(year: int):
    lines = []
    lines.append(f"{'═'*64}")
    lines.append(f"  PAYROLL TAX DEPOSIT CALENDAR — {year}")
    lines.append(f"  {BUSINESS}")
    lines.append(f"{'═'*64}")
    lines.append(f"  All deposits via IRS EFTPS: https://www.eftps.gov")
    lines.append(f"  SUTA / state income tax: through your state agency portal")
    lines.append(f"\n  FEDERAL DEADLINES")
    lines.append(f"  {'Event':<42} {'Due Date'}")
    lines.append(f"  {'─'*42} {'─'*15}")

    events = [
        (f"941 Q1 ({year}) filing + deposit", date(year, 4, 30)),
        (f"941 Q2 ({year}) filing + deposit", date(year, 7, 31)),
        (f"941 Q3 ({year}) filing + deposit", date(year, 10, 31)),
        (f"941 Q4 ({year}) filing + deposit", date(year + 1, 1, 31)),
        (f"940 FUTA annual ({year}) filing",   date(year + 1, 1, 31)),
        (f"W-2 to employees + SSA ({year})",   date(year + 1, 1, 31)),
        (f"1099-NEC to contractors + IRS ({year})", date(year + 1, 1, 31)),
    ]
    # Monthly deposit reminders (15th of each following month)
    for m in range(1, 13):
        dep_date = date(year, m, 15) + relativedelta(months=1)
        events.append((f"941 monthly deposit — wages paid in {date(year,m,1).strftime('%B')}", dep_date))

    events.sort(key=lambda x: x[1])
    today = date.today()
    for label, d in events:
        status = "  ← UPCOMING" if d >= today else ""
        lines.append(f"  {label:<42} {d.strftime('%b %d, %Y')}{status}")

    lines.append(f"\n  REMINDER: Late deposits incur penalties of 2–15% of the deposit amount.")
    lines.append(f"  Enroll in EFTPS before your first payroll: eftps.gov")
    lines.append(f"{'═'*64}")
    print("\n".join(lines))


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Payroll tax filing reports.")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--941",              action="store_true", dest="form941",     help="Form 941 quarterly summary")
    mode.add_argument("--940",              action="store_true", dest="form940",     help="Form 940 annual FUTA summary")
    mode.add_argument("--w2",               action="store_true", dest="formw2",      help="W-2 preparation data")
    mode.add_argument("--1099",             action="store_true", dest="form1099",    help="1099-NEC preparation data")
    mode.add_argument("--suta",             action="store_true", dest="formsuta",    help="State unemployment quarterly")
    mode.add_argument("--deposit-calendar", action="store_true", dest="depcal",      help="Tax deposit due date calendar")

    parser.add_argument("--quarter", type=str, choices=["Q1","Q2","Q3","Q4"], help="Quarter (Q1–Q4)")
    parser.add_argument("--year",    type=int, default=date.today().year,      help="Tax year (default: current year)")
    parser.add_argument("--export",  action="store_true",                      help="Export to .tmp/ as CSV/TXT")

    args = parser.parse_args()

    if args.form941 or args.formsuta:
        if not args.quarter:
            parser.error("--941 and --suta require --quarter Q1|Q2|Q3|Q4")

    conn = get_db()
    cur  = conn.cursor()

    try:
        if args.depcal:
            report_deposit_calendar(args.year)
        elif args.form941:
            report_941(cur, args.quarter, args.year, args.export)
        elif args.form940:
            report_940(cur, args.year, args.export)
        elif args.formw2:
            report_w2(cur, args.year, args.export)
        elif args.form1099:
            report_1099(cur, args.year, args.export)
        elif args.formsuta:
            report_suta(cur, args.quarter, args.year, args.export)
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
