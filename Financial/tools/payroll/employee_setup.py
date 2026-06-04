"""
employee_setup.py

Manage the employee payroll records (W-2 employees and 1099 contractors).
Links to the existing technicians table.

Usage:
    python Financial/tools/payroll/employee_setup.py --list
    python Financial/tools/payroll/employee_setup.py --add 3 --type w2 --filing-status single --state CA --pay-basis hourly --rate 18
    python Financial/tools/payroll/employee_setup.py --add 5 --type contractor
    python Financial/tools/payroll/employee_setup.py --update 3 --rate 20 --state TX
    python Financial/tools/payroll/employee_setup.py --show 3
    python Financial/tools/payroll/employee_setup.py --deactivate 3
"""

import os
import sys
import argparse
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

load_dotenv(os.path.join(ROOT, ".env"))

VALID_FILING = ("single", "married", "head_of_household")
VALID_PAY    = ("hourly", "salary", "commission", "hybrid")
VALID_TYPES  = ("w2", "contractor")


def get_db():
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL not set in .env")
    return psycopg2.connect(url, cursor_factory=psycopg2.extras.RealDictCursor)


def fmt_rate(n):
    return f"${float(n):,.2f}" if n else "—"


def get_tech_name(cur, tech_id: int) -> str:
    cur.execute("SELECT first_name, last_name FROM technicians WHERE id = %s", (tech_id,))
    r = cur.fetchone()
    return f"{r['first_name']} {r['last_name']}" if r else f"#{tech_id}"


# ── Commands ──────────────────────────────────────────────────────────────────

def cmd_list(cur):
    cur.execute("""
        SELECT
            e.id, e.technician_id,
            t.first_name || ' ' || t.last_name AS name,
            e.employee_type, e.active,
            e.filing_status, e.state_code,
            e.pay_basis, e.hourly_rate, e.salary_annual, e.commission_rate,
            e.federal_allowances, e.federal_extra_withholding
        FROM employees e
        JOIN technicians t ON t.id = e.technician_id
        ORDER BY e.active DESC, name
    """)
    rows = cur.fetchall()
    if not rows:
        print("No employees configured. Use --add to set up your first employee.")
        return

    print(f"\n{'ID':<4} {'Name':<22} {'Type':<12} {'Pay Basis':<12} {'Rate/Salary':<14} {'State':<6} {'Status'}")
    print("─" * 80)
    for r in rows:
        pay_display = ""
        if r["pay_basis"] == "hourly":
            pay_display = fmt_rate(r["hourly_rate"]) + "/hr"
        elif r["pay_basis"] == "salary":
            pay_display = fmt_rate(r["salary_annual"]) + "/yr"
        elif r["pay_basis"] == "commission":
            pay_display = f"{float(r['commission_rate'])*100:.0f}% comm"
        elif r["pay_basis"] == "hybrid":
            pay_display = f"{fmt_rate(r['hourly_rate'])}/hr + {float(r['commission_rate'])*100:.0f}%"

        status = "active" if r["active"] else "inactive"
        state = r["state_code"] or "—"
        print(f"  {r['technician_id']:<4} {r['name']:<22} {r['employee_type']:<12} {r['pay_basis']:<12} {pay_display:<14} {state:<6} {status}")
    print()


def cmd_show(cur, tech_id: int):
    cur.execute("""
        SELECT e.*, t.first_name || ' ' || t.last_name AS name
        FROM employees e
        JOIN technicians t ON t.id = e.technician_id
        WHERE e.technician_id = %s
    """, (tech_id,))
    r = cur.fetchone()
    if not r:
        print(f"No employee record for technician_id {tech_id}. Use --add to create one.")
        return

    print(f"\n{'═'*54}")
    print(f"  Employee Record — {r['name']}")
    print(f"{'═'*54}")
    print(f"  Technician ID:       {r['technician_id']}")
    print(f"  Type:                {r['employee_type'].upper()}")
    print(f"  Status:              {'Active' if r['active'] else 'Inactive'}")
    print(f"  Pay Basis:           {r['pay_basis']}")
    if r["pay_basis"] in ("hourly", "hybrid"):
        print(f"  Hourly Rate:         {fmt_rate(r['hourly_rate'])}")
    if r["pay_basis"] == "salary":
        print(f"  Annual Salary:       {fmt_rate(r['salary_annual'])}")
    if r["pay_basis"] in ("commission", "hybrid"):
        print(f"  Commission Rate:     {float(r['commission_rate'])*100:.1f}%")

    if r["employee_type"] == "w2":
        print(f"\n  Tax Info")
        print(f"  Filing Status:       {r['filing_status']}")
        print(f"  Federal Allowances:  {r['federal_allowances']} (W-4)")
        print(f"  Extra Fed. W/H:      {fmt_rate(r['federal_extra_withholding'])}/period")
        print(f"  State:               {r['state_code'] or '(not set)'}")
        print(f"  State Allowances:    {r['state_allowances']}")
        print(f"  Extra State W/H:     {fmt_rate(r['state_extra_withholding'])}/period")
        if r["suta_rate"]:
            print(f"  SUTA Rate:           {float(r['suta_rate'])*100:.3f}%")
        if r["ssn_last4"]:
            print(f"  SSN (last 4):        ***-**-{r['ssn_last4']}")

    if r["employee_type"] == "contractor":
        if r["ein"]:
            print(f"  EIN:                 {r['ein']}")
        if r["ssn_last4"]:
            print(f"  SSN (last 4):        ***-**-{r['ssn_last4']}")

    if r["email"]:
        print(f"\n  Email:               {r['email']}")
    if r["notes"]:
        print(f"  Notes:               {r['notes']}")
    print(f"{'═'*54}\n")


def cmd_add(cur, conn, args):
    tech_id = args.add
    cur.execute("SELECT id, first_name, last_name FROM technicians WHERE id = %s", (tech_id,))
    tech = cur.fetchone()
    if not tech:
        print(f"ERROR: No technician with id {tech_id}")
        sys.exit(1)

    cur.execute("SELECT id FROM employees WHERE technician_id = %s", (tech_id,))
    if cur.fetchone():
        print(f"Employee record already exists for {tech['first_name']} {tech['last_name']}. Use --update instead.")
        sys.exit(1)

    emp_type = (args.type or "w2").lower()
    if emp_type not in VALID_TYPES:
        print(f"--type must be one of: {VALID_TYPES}")
        sys.exit(1)

    filing  = (args.filing_status or "single").lower().replace("-", "_").replace(" ", "_")
    pay_basis = (args.pay_basis or "hourly").lower()
    state = (args.state or "").upper() or None

    cur.execute("""
        INSERT INTO employees (
            technician_id, employee_type, filing_status,
            federal_allowances, federal_extra_withholding,
            state_code, state_allowances, state_extra_withholding,
            pay_basis, hourly_rate, salary_annual, commission_rate,
            suta_rate, ssn_last4, ein, email, notes
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """, (
        tech_id, emp_type, filing,
        args.federal_allowances or 0,
        args.federal_extra or 0.0,
        state,
        args.state_allowances or 0,
        args.state_extra or 0.0,
        pay_basis,
        args.rate or 0.0,
        args.salary or 0.0,
        args.commission_rate or 0.45,
        args.suta_rate or None,
        args.ssn_last4 or None,
        args.ein or None,
        args.email or None,
        args.notes or None,
    ))
    conn.commit()
    name = f"{tech['first_name']} {tech['last_name']}"
    print(f"Employee record created for {name} (ID {tech_id}) — type: {emp_type.upper()}, pay: {pay_basis}")


def cmd_update(cur, conn, args):
    tech_id = args.update
    cur.execute("SELECT * FROM employees WHERE technician_id = %s", (tech_id,))
    emp = cur.fetchone()
    if not emp:
        print(f"No employee record for technician_id {tech_id}. Use --add first.")
        sys.exit(1)

    updates = {}
    if args.type:               updates["employee_type"]             = args.type.lower()
    if args.filing_status:      updates["filing_status"]             = args.filing_status.lower().replace("-","_").replace(" ","_")
    if args.federal_allowances is not None: updates["federal_allowances"] = args.federal_allowances
    if args.federal_extra is not None:      updates["federal_extra_withholding"] = args.federal_extra
    if args.state:              updates["state_code"]                = args.state.upper()
    if args.state_allowances is not None:   updates["state_allowances"] = args.state_allowances
    if args.state_extra is not None:        updates["state_extra_withholding"] = args.state_extra
    if args.pay_basis:          updates["pay_basis"]                 = args.pay_basis.lower()
    if args.rate is not None:   updates["hourly_rate"]               = args.rate
    if args.salary is not None: updates["salary_annual"]             = args.salary
    if args.commission_rate is not None: updates["commission_rate"]  = args.commission_rate
    if args.suta_rate is not None:       updates["suta_rate"]        = args.suta_rate
    if args.ssn_last4:          updates["ssn_last4"]                 = args.ssn_last4
    if args.ein:                updates["ein"]                       = args.ein
    if args.email:              updates["email"]                     = args.email
    if args.notes:              updates["notes"]                     = args.notes

    if not updates:
        print("Nothing to update. Provide at least one field to change.")
        return

    set_clause = ", ".join(f"{k} = %s" for k in updates)
    values = list(updates.values()) + [tech_id]
    cur.execute(f"UPDATE employees SET {set_clause}, updated_at = NOW() WHERE technician_id = %s", values)
    conn.commit()
    name = get_tech_name(cur, tech_id)
    print(f"Updated {name}: {', '.join(updates.keys())}")


def cmd_deactivate(cur, conn, tech_id: int):
    cur.execute("UPDATE employees SET active = FALSE, updated_at = NOW() WHERE technician_id = %s", (tech_id,))
    conn.commit()
    name = get_tech_name(cur, tech_id)
    print(f"{name} marked inactive (excluded from future pay runs).")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Manage employee payroll records.")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--list",        action="store_true",    help="List all employees")
    mode.add_argument("--show",        type=int, metavar="ID", help="Show full record for technician_id")
    mode.add_argument("--add",         type=int, metavar="ID", help="Add employee record for technician_id")
    mode.add_argument("--update",      type=int, metavar="ID", help="Update employee record for technician_id")
    mode.add_argument("--deactivate",  type=int, metavar="ID", help="Mark employee inactive")

    # Shared fields
    parser.add_argument("--type",               choices=VALID_TYPES,    help="w2 or contractor")
    parser.add_argument("--filing-status",       choices=VALID_FILING,   help="single | married | head_of_household")
    parser.add_argument("--pay-basis",           choices=VALID_PAY,      help="hourly | salary | commission | hybrid")
    parser.add_argument("--rate",                type=float,             help="Hourly rate ($/hr)")
    parser.add_argument("--salary",              type=float,             help="Annual salary ($)")
    parser.add_argument("--commission-rate",     type=float,             help="Commission rate 0-1 (e.g. 0.45 = 45%%)")
    parser.add_argument("--state",               type=str,               help="2-letter state code (e.g. CA, TX)")
    parser.add_argument("--federal-allowances",  type=int,               help="W-4 allowances (pre-2020 W-4)")
    parser.add_argument("--federal-extra",       type=float,             help="Extra federal withholding per period ($)")
    parser.add_argument("--state-allowances",    type=int,               help="State allowances")
    parser.add_argument("--state-extra",         type=float,             help="Extra state withholding per period ($)")
    parser.add_argument("--suta-rate",           type=float,             help="Assigned SUTA rate (from state notice, e.g. 0.027)")
    parser.add_argument("--ssn-last4",           type=str,               help="Last 4 digits of SSN (for pay stubs)")
    parser.add_argument("--ein",                 type=str,               help="Contractor EIN (if applicable)")
    parser.add_argument("--email",               type=str,               help="Employee email for pay stub delivery")
    parser.add_argument("--notes",               type=str,               help="Internal notes")

    args = parser.parse_args()

    conn = get_db()
    cur  = conn.cursor()

    try:
        if args.list:
            cmd_list(cur)
        elif args.show:
            cmd_show(cur, args.show)
        elif args.add:
            cmd_add(cur, conn, args)
        elif args.update:
            cmd_update(cur, conn, args)
        elif args.deactivate:
            cmd_deactivate(cur, conn, args.deactivate)
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
