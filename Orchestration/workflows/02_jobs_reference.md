# Workflow: Jobs Reference

**What each automated job does, when it runs, and how to override it manually.**

---

## Job 1: Daily Review Requests

**File:** `jobs/daily_review_requests.py`
**Schedule:** Every day at 6:00 PM
**Trigger type:** Time-based + event-based (appointment completion)

**What it does:**
1. Queries the DB for appointments completed today
2. Filters out clients who have already received a review request in the past 90 days (checks event log)
3. Filters out clients with flagged negative notes
4. Sends SMS review request via Twilio (falls back to email if no phone)
5. Logs each send to `.tmp/event_log.csv`

**Manual run:**
```bash
python Orchestration/jobs/daily_review_requests.py
python Orchestration/jobs/daily_review_requests.py --dry-run
python Orchestration/jobs/daily_review_requests.py --date 2026-05-15  # specific date
```

**Disable:** `DISABLE_REVIEW_REQUESTS=true` in `.env`

---

## Job 2: Morning Briefing

**File:** `tools/briefing.py`
**Schedule:** Every day at 8:00 AM
**Trigger type:** Time-based

**What it does:**
1. Pulls yesterday's revenue and compares to prior week
2. Lists any clients who crossed a lapse threshold overnight
3. Checks cash flow projection — alerts if below threshold
4. Lists pending referral rewards to issue
5. Lists any jobs that failed in the past 24 hours
6. Emails full summary to `OWNER_EMAIL`

**Manual run:**
```bash
python Orchestration/tools/briefing.py
python Orchestration/tools/briefing.py --preview   # print to terminal, don't send
```

**Disable:** `DISABLE_BRIEFING=true` in `.env`

---

## Job 3: Cash Flow Alert

**File:** `jobs/cash_flow_alert.py`
**Schedule:** Daily at 8:00 AM (runs alongside briefing)
**Trigger type:** Time-based + threshold

**What it does:**
1. Runs the 13-week cash flow projection
2. Checks if any week in the next 4 weeks falls below `CASH_ALERT_THRESHOLD`
3. If alert triggered: sends urgent email to `OWNER_EMAIL` with specific week and projected shortfall
4. If healthy: logs silently (no email)

**Manual run:**
```bash
python Orchestration/jobs/cash_flow_alert.py
python Orchestration/jobs/cash_flow_alert.py --dry-run
```

---

## Job 4: Weekly Revenue Report

**File:** `jobs/weekly_revenue_report.py`
**Schedule:** Every Monday at 8:00 AM
**Trigger type:** Time-based

**What it does:**
1. Pulls last 7 days of revenue by day and technician
2. Compares to prior week and prior month same week
3. Calculates week's top performer, no-show count and cost
4. Formats into a clean email and sends to `OWNER_EMAIL`

**Manual run:**
```bash
python Orchestration/jobs/weekly_revenue_report.py
python Orchestration/jobs/weekly_revenue_report.py --dry-run
python Orchestration/jobs/weekly_revenue_report.py --week 2026-05-11  # specific week start
```

---

## Job 5: Monthly Reactivation Campaign

**File:** `jobs/monthly_reactivation.py`
**Schedule:** 1st of every month at 9:00 AM
**Trigger type:** Time-based

**What it does:**
1. Runs all four lapse segments (at-risk, lapsed, dormant, cold)
2. Filters clients who have already been contacted in this window
3. Sends appropriate email per segment using templates from `marketing/templates/`
4. For dormant high-LTV clients: sends personalized SMS
5. Logs all sends to event log

**Manual run:**
```bash
python Orchestration/jobs/monthly_reactivation.py
python Orchestration/jobs/monthly_reactivation.py --dry-run
python Orchestration/jobs/monthly_reactivation.py --segment lapsed  # single segment
```

**Disable:** `DISABLE_REACTIVATION=true` in `.env`

---

## Job 6: Monthly Payroll Report

**File:** `jobs/monthly_payroll.py`
**Schedule:** 1st of every month at 9:30 AM
**Trigger type:** Time-based

**What it does:**
1. Calculates commissions for all technicians for the prior month
2. Formats the payroll report
3. Emails report to `OWNER_EMAIL` with subject: "Payroll Ready — [Month]"
4. Logs run to orchestration log

**Manual run:**
```bash
python Orchestration/jobs/monthly_payroll.py
python Orchestration/jobs/monthly_payroll.py --dry-run
python Orchestration/jobs/monthly_payroll.py --month 2026-05
```

---

## Event Listener Triggers

**File:** `tools/event_listener.py`
**Runs:** Continuously (polls DB every 5 minutes)

| Condition Checked | Action Fired |
|---|---|
| Appointment marked complete (new since last poll) | Queue review request for 1hr later |
| Client last visit = exactly 45 days ago | Send at-risk nurture email |
| Client last visit = exactly 90 days ago | Send dormant win-back email |
| New client in referral log with `visit_completed=yes, reward_issued=no` | Send reward notification to referrer |

**Event deduplication:** Every event is logged with a unique key (`event_type:entity_id`). The listener checks this log before firing to prevent duplicate sends.

---

## Event Log Schema

`.tmp/event_log.csv` — one row per event fired:

| Column | Description |
|---|---|
| `timestamp` | When the event fired |
| `event_type` | `review_request`, `reactivation_45`, `reactivation_90`, `referral_reward`, etc. |
| `entity_id` | Client ID or appointment ID |
| `channel` | `sms` or `email` |
| `recipient` | Phone or email address |
| `status` | `sent`, `failed`, `dry_run`, `skipped` |
| `note` | Any error message or skip reason |

---

## Orchestration Log Schema

`.tmp/orchestration_log.csv` — one row per job run:

| Column | Description |
|---|---|
| `timestamp` | When the job ran |
| `job_name` | Name of the job |
| `status` | `success`, `failed`, `dry_run` |
| `actions_taken` | Count of emails/SMS sent |
| `duration_seconds` | How long it took |
| `error` | Error message if failed |
