# Workflow: P&L Report & Tax Export

**Objective:** Generate a complete Profit & Loss statement for any period, and produce a tax-ready export your accountant can import directly.

**Inputs required:** DATABASE_URL, `.tmp/expenses.csv` populated, completed transactions in POS DB

**Outputs:** Formatted P&L report, tax-ready CSV export, year-end summary

**Tool:** `tools/pl_report.py`

---

## The P&L Structure

```
GROSS REVENUE
  - Discounts & Refunds
= NET REVENUE

COST OF GOODS SOLD (COGS)
  - Retail product cost (supplies used for services)
  - Products sold to clients (cost only)
= GROSS PROFIT

OPERATING EXPENSES
  - Payroll / Commissions
  - Rent
  - Utilities
  - Software / Subscriptions
  - Marketing
  - Equipment
  - Education
  - Insurance
  - Banking / Processing Fees
  - Miscellaneous
= TOTAL OPERATING EXPENSES

= NET OPERATING INCOME (EBITDA approximation)

  - Depreciation (if applicable)
= NET PROFIT (LOSS)
```

---

## Running P&L Reports

```bash
# Current month
python Financial/tools/pl_report.py --monthly

# Specific month
python Financial/tools/pl_report.py --monthly --month 2026-04

# Current week
python Financial/tools/pl_report.py --weekly

# Year to date
python Financial/tools/pl_report.py --ytd

# Full year (for tax export)
python Financial/tools/pl_report.py --year 2026

# Export to CSV (for accountant)
python Financial/tools/pl_report.py --year 2026 --export
```

---

## Sample P&L Output

```
PROFIT & LOSS — May 2026
Business: [Your Business Name]
================================================

REVENUE
  Gross revenue             $14,525.00
  Discounts applied         -$   432.00
  Refunds                   -$    85.00
  Net Revenue               $14,008.00

COST OF GOODS SOLD
  Supplies (service use)    -$ 1,200.00
  Retail COGS               -$   340.00
  Gross Profit              $12,468.00    (89.0% margin)

OPERATING EXPENSES
  Payroll / Commissions     -$ 6,677.75
  Rent                      -$ 1,500.00
  Software                  -$   189.00
  Marketing                 -$   350.00
  Utilities                 -$   280.00
  Insurance                 -$   150.00
  Banking fees              -$   218.00
  Miscellaneous             -$    95.00
  Total Expenses            -$ 9,459.75

================================================
NET PROFIT                   $ 3,008.25    (21.5% margin)
================================================
```

---

## Profit Margin Benchmarks

| Margin | What It Means |
|---|---|
| <10% | Thin — vulnerable to any revenue dip |
| 10-20% | Acceptable — room to improve |
| 20-30% | Healthy — stable business |
| 30%+ | Strong — reinvest or build reserve |

If margin is consistently below 15%, the P&L will show you exactly which expense category is out of proportion.

---

## Monthly Close Process (30 Minutes)

1. Make sure all expenses for the month are logged in the expense tracker
2. Run: `python Financial/tools/pl_report.py --monthly`
3. Review: is net profit where you expected?
4. Flag any expense category that is unusually high
5. Compare to prior month — what changed?
6. Screenshot or save the output for your records

---

## Tax Export

At year-end, generate the tax package:

```bash
python Financial/tools/pl_report.py --year 2026 --export
```

This produces `.tmp/tax_export_2026.csv` with:
- Monthly P&L summary (12 rows)
- Full expense detail by category
- Gross revenue, net revenue, and net profit per month
- Annual totals

Send this file to your accountant along with:
- Bank statements (12 months)
- Payroll log: `.tmp/payroll_log.csv`
- Referral/gift card liability (if applicable)

---

## Quarterly Estimated Taxes

If you're a sole proprietor or LLC, you likely owe quarterly estimated taxes. Due dates:
- Q1 (Jan-Mar) → April 15
- Q2 (Apr-May) → June 15
- Q3 (Jun-Aug) → September 15
- Q4 (Sep-Dec) → January 15

**Rough estimate:** Set aside 25-30% of net profit each month into a separate tax savings account.

Run: `python Financial/tools/pl_report.py --ytd` before each due date to see your year-to-date net profit, then multiply by your effective tax rate.

---

## Edge Cases

- **Cash payments not in POS:** These must be entered manually. Underreporting cash income is a tax risk — log it.
- **Owner's draw:** Not an expense — it comes out of profit after the P&L. Do not log as a business expense.
- **Loan payments:** Only the interest portion is deductible, not the principal repayment.
- **Equipment purchase >$2,500:** May need to be capitalized and depreciated rather than expensed. Flag with `--note "Check depreciation"` and confirm with accountant.
