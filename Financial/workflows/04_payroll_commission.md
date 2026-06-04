# Workflow: Payroll & Commission Tracking

**Objective:** Calculate accurate commissions for each staff member at the end of every pay period, with full audit trail and per-technician breakdowns.

**Inputs required:** DATABASE_URL, completed transactions in POS DB, commission rates per technician

**Outputs:** Commission report per staff member, payroll summary, payment log

**Tool:** `tools/payroll_commission.py`

---

## Commission Structure Options

The tool supports three models. Set per-technician in `.tmp/payroll_overrides.csv` or use the default from `.env`.

| Model | How It Works | When to Use |
|---|---|---|
| **Flat %** | Technician earns X% of every service they perform | Most common — simple and predictable |
| **Tiered %** | % increases as they hit revenue thresholds | Incentivizes high performers |
| **Hourly + flat %** | Base hourly rate + smaller % commission | For W-2 employees (not contractors) |

### Default Setup (Flat %)

Set in `.env`:
```
DEFAULT_COMMISSION_RATE=0.45
```

This means each technician earns 45% of the revenue they generate. The remaining 55% covers rent, supplies, software, and owner profit.

### Per-Technician Overrides

Create `.tmp/payroll_overrides.csv` with columns:
```
technician_id, technician_name, commission_rate, model, hourly_rate
```

Example:
```
1, Sarah Johnson, 0.50, flat, 0
2, Marcus Lee, 0.45, flat, 0
3, Amy Chen, 0.40, tiered, 0
```

---

## Pay Period Options

| Period | Typical for |
|---|---|
| Weekly | High-volume staff, commissioned |
| Bi-weekly | Most common for employees |
| Monthly | Booth renters / 1099 contractors |

Set in `.env`:
```
PAY_PERIOD=monthly
```

---

## Running Payroll

```bash
# Current pay period
python Financial/tools/payroll_commission.py --period monthly

# Specific month
python Financial/tools/payroll_commission.py --period monthly --month 2026-05

# Single technician
python Financial/tools/payroll_commission.py --period monthly --tech-id 2

# Export to CSV for records
python Financial/tools/payroll_commission.py --period monthly --export
```

---

## Reading the Report

```
PAYROLL REPORT — May 2026
================================================
Technician    Services  Revenue    Rate    Commission
Sarah J.      48        $6,240     50%     $3,120.00
Marcus L.     39        $4,875     45%     $2,193.75
Amy C.        31        $3,410     40%     $1,364.00
------------------------------------------------
TOTAL                   $14,525             $6,677.75
Business keeps:         $7,847.25  (54%)
```

---

## Tiered Commission Example

If a technician earns tiered commissions:
```
$0 - $3,000 revenue → 40%
$3,001 - $5,000 revenue → 45%
$5,001+ revenue → 50%
```

Set in `.tmp/payroll_overrides.csv`:
```
3, Amy Chen, tiered, "0:3000:0.40|3001:5000:0.45|5001:99999:0.50"
```

The tool calculates each tier separately and sums them.

---

## Contractor vs. Employee

**1099 Contractor (Booth Renter):**
- They pay you rent (fixed or % of revenue)
- You do NOT withhold taxes
- Issue a 1099-NEC if you pay them $600+ in a year
- Their commission report is for their records, not yours to file

**W-2 Employee:**
- You withhold federal + state income tax, Social Security, Medicare
- You pay employer's share of Social Security + Medicare (7.65%)
- Use a payroll service (Gusto, ADP, QuickBooks Payroll) — do NOT do this manually
- The commission tool calculates gross pay; the payroll service handles withholding

The tool labels each technician's type in the report. Confirm with your accountant which applies to each staff member.

---

## Payment Log

After running payroll, log each payment:
```bash
python Financial/tools/payroll_commission.py --log-payment --tech-id 1 --amount 3120 --date 2026-05-31 --method check
```

This appends to `.tmp/payroll_log.csv` — your permanent payroll record.

---

## Edge Cases

- **Technician split a service with another:** Log in POS with split attribution. The tool reads per-technician transaction data.
- **Client used gift card:** Full service value still counts as revenue for commission purposes (gift card was revenue when sold).
- **Refund issued:** Commission is reversed for that transaction.
- **Technician had sick day (hourly model):** Log hours manually in `.tmp/payroll_overrides.csv` with `--hours` flag.
