# Workflow 07: Payroll System

## What This System Does

Handles weekly payroll for both W-2 employees and 1099 contractors with full tax calculations. Produces pay stubs, tracks YTD withholding, and generates the data you need for every required tax filing.

**What it calculates automatically:**
- Federal income tax withholding (IRS Publication 15-T method)
- FICA: Social Security (6.2%) + Medicare (1.45%) — both sides
- Additional Medicare (0.9% on wages over $200K)
- State income tax withholding (20+ states supported)
- State disability insurance where applicable (CA SDI, NY, NJ)
- Employer FUTA (Federal Unemployment, 0.6% net)
- Employer SUTA (State Unemployment — uses your assigned rate)
- Overtime at 1.5× for hours over 40 per week

**What it does NOT do:**
- Electronic filing (you file 941/940/W-2/1099 yourself through IRS EFTPS or payroll software)
- Direct deposit (you issue payments; the system tracks them)
- Pre-tax deductions like 401k or health insurance (add those manually to the export data)

---

## Required .env Variables

| Variable | Example | Required |
|---|---|---|
| `DATABASE_URL` | `postgres://...` | Yes |
| `EMPLOYER_STATE` | `CA` | Yes — set to your business's state |
| `EMPLOYER_EIN` | `12-3456789` | Needed for tax reports |
| `BUSINESS_NAME` | `Luxury Nails` | For pay stubs |

---

## One-Time Setup

### Step 1 — Create payroll tables
```bash
python Financial/tools/payroll/migrate.py
```

### Step 2 — Add .env variables
```
EMPLOYER_STATE=CA
EMPLOYER_EIN=12-3456789
```

### Step 3 — Set up each employee
See the Employee Setup section below.

### Step 4 — Install dependencies
```bash
pip install -r Orchestration/requirements.txt
```

---

## Employee Setup

Every person you pay needs a record that links their technician ID to their tax information.

### Add a W-2 hourly employee
```bash
python Financial/tools/payroll/employee_setup.py \
  --add 3 \
  --type w2 \
  --filing-status single \
  --state CA \
  --pay-basis hourly \
  --rate 18.00 \
  --ssn-last4 1234 \
  --email jane@example.com
```

### Add a W-2 salaried employee
```bash
python Financial/tools/payroll/employee_setup.py \
  --add 4 --type w2 --filing-status married --state TX \
  --pay-basis salary --salary 52000
```

### Add a 1099 contractor
```bash
python Financial/tools/payroll/employee_setup.py \
  --add 5 --type contractor --pay-basis commission --commission-rate 0.45
```

### Add a hybrid employee (hourly + commission)
```bash
python Financial/tools/payroll/employee_setup.py \
  --add 6 --type w2 --filing-status single --state CA \
  --pay-basis hybrid --rate 14.00 --commission-rate 0.20
```

### List all employees
```bash
python Financial/tools/payroll/employee_setup.py --list
```

### Update an employee (e.g., after they submit a new W-4)
```bash
python Financial/tools/payroll/employee_setup.py \
  --update 3 --filing-status married --federal-allowances 2
```

### Deactivate (stops appearing in pay runs)
```bash
python Financial/tools/payroll/employee_setup.py --deactivate 3
```

---

## Pay Basis Options

| `--pay-basis` | How gross pay is calculated |
|---|---|
| `hourly` | Hours from time clock × hourly rate. OT at 1.5× over 40 hrs/week. |
| `salary` | Annual salary ÷ 52 per week. No hours required. |
| `commission` | Revenue × commission rate (pulled from transactions table). |
| `hybrid` | Hourly pay + commission pay combined. |

**For hourly to work:** the time clock system must be running so `time_entries` table has data. If no time clock is used, enter hours manually via the admin panel.

---

## Weekly Pay Run

### Preview without saving
```bash
python Financial/tools/payroll/run_payroll.py --dry-run
```
Defaults to the prior Monday–Sunday pay period.

### Preview a specific week
```bash
python Financial/tools/payroll/run_payroll.py --dry-run --week 2026-05-12
```

### Run and save payroll
```bash
python Financial/tools/payroll/run_payroll.py --run
```
You'll be asked to confirm before anything is saved. The run is saved as **DRAFT**.

### Print pay stubs
```bash
python Financial/tools/payroll/run_payroll.py --stubs --run-id 4
```

### Mark as paid (after issuing all payments)
```bash
python Financial/tools/payroll/run_payroll.py --approve --run-id 4
```
This step is critical — YTD calculations only include PAID runs. Mark paid immediately after issuing checks/transfers.

### Void a run (if you made an error)
```bash
python Financial/tools/payroll/run_payroll.py --void --run-id 4
```

### List all runs
```bash
python Financial/tools/payroll/run_payroll.py --list
```

---

## Tax Filing Reports

### Form 941 — Quarterly (federal)
File by April 30, July 31, October 31, January 31.
```bash
python Financial/tools/payroll/reports.py --941 --quarter Q1 --year 2026
python Financial/tools/payroll/reports.py --941 --quarter Q1 --year 2026 --export
```
The report gives you every line item you need to fill out Form 941 on IRS.gov or via EFTPS.

### Form 940 — Annual FUTA
File by January 31 of the following year.
```bash
python Financial/tools/payroll/reports.py --940 --year 2026
```

### W-2 Preparation
Due January 31 — send to employees AND file with SSA.
```bash
python Financial/tools/payroll/reports.py --w2 --year 2026 --export
```
Export produces a CSV with Box 1, 2, 3, 4, 5, 6, 16, 17 values. Bring this to your accountant or enter into SSA Business Services Online.

### 1099-NEC Preparation
Due January 31 — send to contractors AND file with IRS.
```bash
python Financial/tools/payroll/reports.py --1099 --year 2026 --export
```
Only contractors paid $600+ get a 1099. Make sure you have a W-9 on file for each one.

### SUTA Quarterly
```bash
python Financial/tools/payroll/reports.py --suta --quarter Q1 --year 2026
```
File through your state's unemployment agency portal. Deadlines vary but are usually the last day of the month following quarter end.

### Tax Deposit Calendar
```bash
python Financial/tools/payroll/reports.py --deposit-calendar --year 2026
```
Shows every deposit and filing deadline for the year, flagging upcoming ones.

---

## Tax Deposit Rules (Federal)

You must deposit federal payroll taxes through [EFTPS](https://www.eftps.gov). Enroll before your first payroll run.

| Quarterly liability | Your schedule |
|---|---|
| Under $2,500 | Pay with Form 941 by the filing deadline |
| $2,500–$50,000 | **Monthly depositor** — deposit by 15th of the following month |
| Over $50,000 | **Semi-weekly depositor** — deposit within 3 banking days of payday |

**Penalty for late deposits: 2%–15% of the deposit amount. Don't be late.**

---

## Weekly Payroll Ritual (15 min every Monday)

1. Check time clock admin for any missing clock-outs from last week
2. Run preview: `python Financial/tools/payroll/run_payroll.py --dry-run`
3. Verify gross pay looks correct for each person
4. Run and save: `python Financial/tools/payroll/run_payroll.py --run`
5. Print stubs: `python Financial/tools/payroll/run_payroll.py --stubs --run-id N`
6. Issue payments (cash, check, or bank transfer)
7. Mark paid: `python Financial/tools/payroll/run_payroll.py --approve --run-id N`
8. Make EFTPS deposit if required (check your deposit schedule)

---

## Year-End Checklist

| Task | When | Command |
|---|---|---|
| Verify all pay runs are marked "paid" | Dec 31 | `--list` |
| Generate W-2 data | Jan 1–31 | `--w2 --year 2026 --export` |
| Generate 1099 data | Jan 1–31 | `--1099 --year 2026 --export` |
| File 940 FUTA | By Jan 31 | `--940 --year 2026` |
| File Q4 Form 941 | By Jan 31 | `--941 --quarter Q4 --year 2026` |
| Distribute W-2s and 1099s | By Jan 31 | (manual) |
| Update tax tables for new year | Jan 1 | Edit `tax_tables.py` |

---

## Updating Tax Tables Each January

The IRS adjusts brackets, the Social Security wage base, and standard deductions annually. After January 1, update these in `Financial/tools/payroll/tax_tables.py`:

1. `STANDARD_DEDUCTION` — from IRS Rev. Proc. (usually +$200–400)
2. `FEDERAL_BRACKETS` — from IRS Publication 15-T
3. `FICA["ss_wage_base"]` — from SSA announcement (usually announced in October)
4. Per-state brackets — from each state's annual withholding publication
5. `SUTA_DEFAULTS` — from your state's new-employer SUTA notice

Your actual SUTA rate (assigned by your state based on claim history) can be set per-employee:
```bash
python Financial/tools/payroll/employee_setup.py --update 3 --suta-rate 0.027
```

---

## Common Questions

**Q: An employee submitted a new W-4. What do I do?**
Update their filing status and allowances:
```bash
python Financial/tools/payroll/employee_setup.py --update 3 --filing-status married --federal-allowances 2
```

**Q: I missed marking a run as paid. Will YTD be wrong?**
Yes — YTD only counts runs with status `paid`. Mark it paid immediately:
```bash
python Financial/tools/payroll/run_payroll.py --approve --run-id N
```

**Q: What if I need to do a correction run?**
Void the incorrect run, fix the underlying issue, and run payroll again:
```bash
python Financial/tools/payroll/run_payroll.py --void --run-id N
python Financial/tools/payroll/run_payroll.py --run --week YYYY-MM-DD
```

**Q: Are contractors included in 941?**
No. Form 941 covers W-2 employees only. Contractors get 1099-NEC but no withholding.

**Q: My state isn't in the tax tables. What do I do?**
Set `EMPLOYER_STATE` to your state and manually calculate state withholding, or set `state_extra_withholding` per employee to a flat amount per period. Then add your state's brackets to `tax_tables.py`.
