# Workflow: Daily Revenue Tracking

**Objective:** Know exactly how much revenue the business generated today, this week, and this month — broken down by service, technician, and payment method.

**Inputs required:** DATABASE_URL in `.env`, completed transactions in POS DB

**Outputs:** Daily revenue snapshot, weekly trend, no-show cost estimate

**Tool:** `tools/daily_revenue.py`

---

## Daily Ritual (5 Minutes — End of Business Day)

Run: `python Financial/tools/daily_revenue.py`

This prints:
- Total revenue for today
- Breakdown by technician
- Breakdown by service category
- Comparison to same day last week
- Running monthly total vs. prior month

Do this every day. Financial awareness is the foundation of every other business decision.

---

## What the Report Shows

### Revenue Metrics
- **Gross revenue** — total charged before any deductions
- **Collected revenue** — actually paid (excludes outstanding balances)
- **Discounts applied** — total markdown from full price
- **Net revenue** — gross minus discounts

### No-Show Cost
Every no-show and last-minute cancellation is lost revenue. The report calculates:
- Number of no-shows / cancellations today
- Estimated revenue lost (based on average service value)
- Running monthly no-show cost

If no-show cost exceeds 10% of potential revenue, implement a deposit policy.

### Technician Breakdown
Revenue generated per staff member — useful for commission calculations and identifying top performers.

---

## Weekly Review (Every Monday Morning)

Run: `python Financial/tools/daily_revenue.py --weekly`

Shows the past 7 days:
- Day-by-day revenue chart (text-based)
- Best and slowest day of the week
- Week-over-week comparison
- Whether you're on pace to hit monthly target

---

## Monthly Snapshot

Run: `python Financial/tools/daily_revenue.py --monthly`

Shows current calendar month:
- Daily revenue totals
- Running MTD vs. prior month MTD
- Projected month-end based on current pace
- Best and worst performing days

---

## Setting a Revenue Target

Before each month, set a revenue target in `.env`:
```
MONTHLY_REVENUE_TARGET=15000
```

The daily report will show: today's progress toward that target and days remaining.

---

## Edge Cases

- **Transaction table doesn't exist yet:** Tool will print a clear warning. Revenue data requires the POS to have processed at least one transaction.
- **Multiple payment methods (cash, card, gift card):** Report breaks these out separately. Cash vs. card split matters for accounting.
- **Refunds:** Shown as negative line items. Net revenue accounts for refunds automatically.
- **Appointments with no POS transaction:** These represent the "gap" — booked but not charged. Monitor this closely.

---

## Success Metrics

| Metric | Target |
|---|---|
| Daily revenue visibility | 100% — checked every day |
| No-show rate | <5% of appointments |
| Revenue growth MoM | +5-10% |
| Revenue per day variance | Understand the pattern, then smooth it |
