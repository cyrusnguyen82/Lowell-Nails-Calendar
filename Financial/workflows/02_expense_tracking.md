# Workflow: Expense Tracking

**Objective:** Log and categorize every business expense so you always know your true profit margin, not just your revenue.

**Inputs required:** Receipts, invoices, bank statements

**Outputs:** Categorized expense log in `.tmp/expenses.csv`, expense summary by category

**Tool:** `tools/expense_tracker.py`

---

## Expense Categories

| Category | Examples |
|---|---|
| `supplies` | Color, products, tools, gloves, foils |
| `retail` | Products sold to clients (COGS) |
| `rent` | Booth rent, suite rent, studio lease |
| `utilities` | Electricity, water, internet, phone |
| `software` | Booking system, POS, email platform, subscriptions |
| `marketing` | Ad spend, printing, signage, photoshoots |
| `payroll` | Staff wages, contractor payments (non-commission) |
| `equipment` | Chairs, dryers, tools, furniture, repairs |
| `education` | Classes, certifications, trade shows |
| `insurance` | Business liability, professional, renter's |
| `banking` | Credit card processing fees, bank fees |
| `misc` | Anything that doesn't fit above |

---

## Logging an Expense

```bash
# Basic
python Financial/tools/expense_tracker.py --add --amount 250 --category supplies --note "Color products - Sally Beauty"

# With date (defaults to today if omitted)
python Financial/tools/expense_tracker.py --add --amount 1200 --category rent --note "May booth rent" --date 2026-05-01

# Recurring expense (flags it for monthly auto-remind)
python Financial/tools/expense_tracker.py --add --amount 89 --category software --note "SendGrid subscription" --recurring
```

---

## Viewing Expenses

```bash
# This month's expenses by category
python Financial/tools/expense_tracker.py --summary

# Specific month
python Financial/tools/expense_tracker.py --summary --month 2026-04

# All expenses in a date range
python Financial/tools/expense_tracker.py --list --from 2026-05-01 --to 2026-05-17
```

---

## Weekly Expense Logging Habit

Every Monday, log all expenses from the prior week before running the P&L report.

Sources to check:
1. **Bank/credit card statement** — any business purchases
2. **Email receipts** — software subscriptions, online orders
3. **Physical receipts** — supplies, meals, fuel
4. **Recurring items** — rent, utilities, insurance (log on the 1st of each month)

Rule: if you paid for it to run the business, it goes in. Every unlogged expense inflates your apparent profit and distorts every decision you make based on that number.

---

## Fixed vs. Variable Expenses

| Type | What it is | Examples |
|---|---|---|
| **Fixed** | Same every month regardless of revenue | Rent, insurance, software |
| **Variable** | Changes with business volume | Supplies, commission, marketing |
| **Semi-variable** | Has a fixed base + variable component | Phone plan, utilities |

Understanding this split matters for cash flow forecasting. Fixed costs are your floor — the minimum you must earn before you make a single dollar of profit.

Set fixed costs in `.env` so the cash flow tool can use them:
```
RENT_MONTHLY=1500
OTHER_FIXED_COSTS=300
```

---

## Tax-Deductible Expense Reminders

Every category above is generally deductible as a business expense. Keep:
- **All receipts** (digital preferred — photograph physical ones immediately)
- **Bank and credit card statements** — monthly downloads
- **Mileage log** if you drive for business (use Notes app or mileage tracker)

At year-end, run: `python Financial/tools/pl_report.py --export --year 2026`
This produces a tax-ready CSV your accountant can import directly.

---

## Edge Cases

- **Personal purchase with business card:** Add a `personal` flag when logging: `--personal` — it's tracked but excluded from business P&L.
- **Mixed purchase (partly business):** Log the business portion only. Note the split in `--note`.
- **Large one-time equipment purchase:** Log as `equipment`. For tax purposes, these may need to be depreciated — flag with `--note "Depreciate over X years"` and confirm with accountant.
- **Expense logged wrong:** Edit `.tmp/expenses.csv` directly — it's a plain CSV file.
