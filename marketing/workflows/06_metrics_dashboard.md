# Workflow: Metrics Dashboard

**Objective:** Maintain a weekly view of the 8 KPIs that determine whether the marketing system is healthy and where to focus next.

**Inputs required:** DATABASE_URL in `.env`, appointment and transaction history in DB

**Outputs:** Weekly KPI snapshot, monthly trend analysis, channel attribution report

**Tool:** `tools/metrics_report.py`

---

## The 8 KPIs

### 1. New Client Acquisition Rate
**What:** Number of first-time clients per week/month
**Why:** Measures top-of-funnel health
**How to pull:** `python tools/metrics_report.py --kpi new_clients`
**Target:** Growing MoM

---

### 2. Returning Client Rate
**What:** % of bookings in a period that are from clients who have booked before
**Why:** Retention health. Below 50% means you're on a treadmill.
**How to pull:** `python tools/metrics_report.py --kpi retention`
**Target:** >60%

---

### 3. Average Transaction Value (ATV)
**What:** Average revenue per POS transaction
**Why:** Measures upsell effectiveness
**How to pull:** `python tools/metrics_report.py --kpi atv`
**Target:** Increasing QoQ

---

### 4. Client Lifetime Value (LTV)
**What:** Average total revenue per client across all visits
**Why:** The most important number. Everything else optimizes toward this.
**How to pull:** `python tools/metrics_report.py --kpi ltv`
**Target:** Increasing QoQ; benchmark against CPA

---

### 5. Booking-to-Revenue Conversion Rate
**What:** % of bookings that result in a completed, paid transaction
**Why:** Measures no-show/cancellation rate
**How to pull:** `python tools/metrics_report.py --kpi conversion`
**Target:** >85%

---

### 6. Referral Attribution Rate
**What:** % of new clients who can be attributed to a referral
**Why:** Measures word-of-mouth health
**How to pull:** `tools/referral_tracker.py --report`
**Target:** 20%+

---

### 7. Churn Rate
**What:** % of clients who visited in a given period and did NOT return in the next equivalent period
**Why:** Catches retention problems before they compound
**How to pull:** `python tools/metrics_report.py --kpi churn`
**Target:** <30%

---

### 8. Reactivation Rate
**What:** % of lapsed clients who returned after a reactivation campaign
**Why:** Measures whether reactivation campaigns are working
**How to pull:** Compare `fetch_lapsed_clients.py` output before/after campaign send
**Target:** >20% overall

---

## Weekly Reporting Ritual (15 minutes every Monday)

1. `python tools/metrics_report.py --weekly` — print all 8 KPIs for the past 7 days
2. Compare to prior week and prior month
3. Flag any metric that moved >10% in either direction
4. Identify one action to take this week based on the data
5. Log the weekly snapshot in `.tmp/metrics_log.csv` (appended automatically by the tool)

---

## Monthly Deep Dive (First Monday of Month, 45 minutes)

1. Run `python tools/metrics_report.py --monthly` — full monthly summary
2. Review channel attribution: which source drove the most new clients?
3. Identify top 20% of clients by spend — are they getting VIP treatment?
4. Identify bottom 20% by visit frequency — reactivation targets?
5. Review referral report from `tools/referral_tracker.py`
6. Update reactivation segments: `python tools/fetch_lapsed_clients.py`
7. Set one growth lever to pull this month (double down on what's working)

---

## Decision Framework

| Symptom | Diagnosis | Action |
|---|---|---|
| New clients flat | Acquisition problem | See `workflows/01_lead_generation.md` |
| Returning rate dropping | Retention problem | Check service quality, add check-in touchpoints |
| ATV declining | Upsell failure | Retrain staff, add POS bundle prompts |
| Churn spike | Satisfaction issue | Survey lapsed clients, read recent reviews |
| Referral rate low | Not asking | Implement ask script from `workflows/04_referral_program.md` |
| LTV growing | Everything working | Increase ad spend, scale |

---

## Benchmarks by Business Type

| Business Type | Healthy Retention | Healthy LTV | Healthy ATV |
|---|---|---|---|
| Hair / nail salon | 65-75% | $500-1,500/yr | $60-150 |
| Spa / massage | 55-65% | $600-2,000/yr | $80-200 |
| Fitness / personal training | 70-80% | $1,000-3,000/yr | $50-100/session |
| Medical aesthetics | 60-70% | $1,500-5,000/yr | $150-500 |
| General service | 50-60% | $300-1,000/yr | $50-150 |

Use these to calibrate targets for your specific business.
