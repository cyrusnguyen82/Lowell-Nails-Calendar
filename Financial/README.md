# Financial Dashboard System

Real-time visibility into revenue, expenses, cash flow, payroll, and tax readiness.
Built on top of the existing booking + POS database.

---

## Structure

```
Financial/
├── workflows/          # SOPs — what to run and when
├── templates/          # Report formats and P&L layouts
└── tools/              # Python scripts that pull from DB + expense log
```

---

## The 5 Financial Pillars

| Pillar | Workflow | Tool |
|---|---|---|
| Daily Revenue | `workflows/01_daily_revenue.md` | `tools/daily_revenue.py` |
| Expense Tracking | `workflows/02_expense_tracking.md` | `tools/expense_tracker.py` |
| Cash Flow | `workflows/03_cash_flow_forecast.md` | `tools/cash_flow_forecast.py` |
| Payroll & Commission | `workflows/04_payroll_commission.md` | `tools/payroll_commission.py` |
| P&L + Tax Export | `workflows/05_pl_and_tax.md` | `tools/pl_report.py` |

---

## Required .env Variables

Add these to the root `.env` file:

```env
# Already present — used by all financial tools
DATABASE_URL=postgres://...

# Business info for report headers
BUSINESS_NAME=Your Business Name
BUSINESS_OWNER=Your Name
TAX_YEAR=2026

# Payroll
DEFAULT_COMMISSION_RATE=0.45       # 45% commission (override per staff in expenses config)
RENT_MONTHLY=0                     # Fixed monthly rent (0 if none)
OTHER_FIXED_COSTS=0                # Any other fixed monthly cost

# Currency
CURRENCY=USD
```

---

## Data Architecture

### From the DB (automated):
- **Revenue** — pulled from `transactions` table (POS)
- **Bookings** — pulled from `appointments` table
- **Staff** — pulled from `technicians` (or `users`) table

### From CSV (you maintain):
- **Expenses** — logged in `.tmp/expenses.csv` using `tools/expense_tracker.py`
- **Payroll adjustments** — overrides in `.tmp/payroll_overrides.csv`

This hybrid approach means you can start immediately without any DB schema changes. When ready, migrate expenses into a proper DB table.

---

## Quick Start

```bash
# 1. Get today's revenue snapshot
python Financial/tools/daily_revenue.py

# 2. Log an expense
python Financial/tools/expense_tracker.py --add --amount 250 --category supplies --note "Color products restock"

# 3. Generate this month's P&L
python Financial/tools/pl_report.py --monthly

# 4. Run payroll / commission report
python Financial/tools/payroll_commission.py --period monthly

# 5. 13-week cash flow forecast
python Financial/tools/cash_flow_forecast.py
```

---

## Weekly Ritual (15 min every Monday)

1. `python Financial/tools/daily_revenue.py --weekly` — last 7 days revenue
2. Log any expenses from the prior week via `expense_tracker.py`
3. `python Financial/tools/pl_report.py --weekly` — check profit margin
4. Flag anything that moved significantly

## Monthly Close (30 min, first day of month)

1. `python Financial/tools/pl_report.py --monthly` — full P&L
2. `python Financial/tools/payroll_commission.py --period monthly` — run commissions
3. `python Financial/tools/cash_flow_forecast.py` — update 13-week outlook
4. Export for accountant: `python Financial/tools/pl_report.py --export`

---

## Key Financial Targets

| Metric | Healthy Range | Tool to Check |
|---|---|---|
| Gross profit margin | >60% (services) | `pl_report.py` |
| Labor cost % of revenue | <40% | `payroll_commission.py` |
| Monthly cash reserve | 3x monthly expenses | `cash_flow_forecast.py` |
| Revenue growth MoM | +5-10% | `daily_revenue.py --monthly` |
| No-show / cancellation cost | <10% of potential revenue | `daily_revenue.py` |
