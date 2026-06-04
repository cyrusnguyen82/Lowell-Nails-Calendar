# Workflow: Cash Flow Forecast

**Objective:** Know 13 weeks ahead whether you'll have enough cash to cover expenses. Prevent surprises before they happen.

**Inputs required:** Revenue history in DB, expense log in `.tmp/expenses.csv`, fixed costs in `.env`

**Outputs:** 13-week rolling cash flow projection, surplus/deficit alerts

**Tool:** `tools/cash_flow_forecast.py`

---

## Why 13 Weeks

13 weeks (one quarter) is the standard cash flow window used by professional operators. It's long enough to see problems before they hit, short enough to be meaningfully accurate.

Beyond 13 weeks, revenue projections become unreliable. Within 13 weeks, you can take action.

---

## How the Forecast Works

The tool builds the projection in three layers:

### Layer 1: Confirmed Revenue (Weeks 1-2)
Pulls upcoming confirmed appointments from the DB and calculates expected revenue based on average transaction value per service type. This is your most reliable number.

### Layer 2: Projected Revenue (Weeks 3-8)
Uses trailing 8-week average revenue by day of week to project forward. Accounts for weekly patterns (busy Fridays, slow Mondays).

### Layer 3: Trend-Adjusted Estimate (Weeks 9-13)
Applies your MoM growth rate to the trailing average. More uncertainty here — useful for direction, not precision.

### Fixed Costs Overlay
Your fixed costs (rent, software, insurance) are subtracted each week they're due, based on what you've entered in `.env` and the expense log.

---

## Running the Forecast

```bash
# Standard 13-week forecast
python Financial/tools/cash_flow_forecast.py

# With a specific starting cash balance
python Financial/tools/cash_flow_forecast.py --cash-on-hand 8500

# Show only weeks where balance goes below threshold
python Financial/tools/cash_flow_forecast.py --alert-threshold 2000
```

---

## Reading the Output

```
WEEK  DATES           PROJ REVENUE  PROJ EXPENSES  NET      BALANCE
W1    May 18-24       $4,200        $1,800         +$2,400  $10,900
W2    May 25-31       $3,800        $2,100         +$1,700  $12,600
W3    Jun 01-07       $4,100        $3,200         +$900    $13,500
W4    Jun 08-14       $3,900        $1,800         +$2,100  $15,600
...
⚠ W9  Jul 13-19       $3,200        $4,100         -$900    $1,200  ← ALERT
```

Any week with a projected balance below your alert threshold is flagged. This gives you 9 weeks to act — not 9 days.

---

## What to Do When You See a Deficit Week

**Option A — Increase revenue:** Run a promotion, reactivation campaign, or push rebooking harder in the weeks prior. See `marketing/workflows/05_reactivation_campaign.md`.

**Option B — Reduce expenses:** Identify variable costs that can be deferred or reduced that week.

**Option C — Smooth cash flow:** Move large expense payments to avoid stacking them in the same week.

**Option D — Build reserve:** If deficits are recurring, the business needs a larger cash cushion. Target: 3 months of fixed expenses in reserve.

---

## Cash Reserve Target

```
Minimum reserve = fixed monthly expenses × 3
```

Example: If fixed costs are $3,000/month → keep $9,000 in the business account before drawing owner's pay.

Set this as a goal in `.env`:
```
CASH_RESERVE_TARGET=9000
```

The forecast will show how many weeks until you hit (or fall below) that target.

---

## Edge Cases

- **Seasonal dips:** If your business has known slow seasons, the trailing-average projection will underestimate the dip. Manually override projected revenue for known slow weeks.
- **Large one-time expenses coming:** Log them in the expense tracker with a future date — they'll appear in the forecast automatically.
- **New business with <8 weeks of history:** The forecast will be less reliable. Focus on Layer 1 (confirmed bookings) only until you have more data.
