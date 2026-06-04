# Orchestration System

The layer that ties Marketing and Financial together and runs everything autonomously.

Once started, this system runs in the background — sending review requests, firing reactivation emails, running payroll reports, alerting on cash flow, and delivering a daily briefing — without any manual intervention.

---

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │          run_all.py                 │
                    │  (single entry point — start here)  │
                    └────────────┬────────────────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              │                                     │
     ┌────────▼────────┐                  ┌─────────▼────────┐
     │  scheduler.py   │                  │ event_listener.py │
     │  (time-based)   │                  │  (trigger-based)  │
     └────────┬────────┘                  └─────────┬────────┘
              │                                     │
     ┌────────▼────────────────────────────────────▼────────┐
     │                     jobs/                            │
     │  daily_review_requests   weekly_revenue_report       │
     │  monthly_reactivation    monthly_payroll             │
     │  cash_flow_alert                                     │
     └─────────────────────────┬────────────────────────────┘
                               │
              ┌────────────────┴────────────────┐
              │        integrations/            │
              │  sendgrid_client  twilio_client  │
              └────────────────┬────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   PostgreSQL DB      │
                    │   + .tmp/ CSVs       │
                    └─────────────────────┘
```

---

## What Runs Automatically

| Job | Trigger | What It Does |
|---|---|---|
| Review requests | Daily 6pm | Finds today's completed appts → sends SMS review ask |
| Morning briefing | Daily 8am | Emails you: revenue, actions needed, alerts |
| Cash flow alert | Daily 8am | Checks balance projection → alerts if below threshold |
| Weekly revenue report | Monday 8am | Week-over-week revenue summary → email |
| Reactivation campaign | 1st of month | Segments lapsed clients → sends win-back emails |
| Payroll report | 1st of month | Calculates commissions → emails report to owner |
| Monthly P&L | 1st of month | Full P&L → emails report to owner |

### Event-Based Triggers (run within minutes of the event)

| Event | Action |
|---|---|
| Appointment status → completed | Queue review request (fires 1hr later) |
| Client crosses 45-day inactivity | Enter at-risk nurture email |
| Client crosses 90-day inactivity | Enter dormant win-back sequence |
| New referral visit completed | Log reward, notify referrer |

---

## Required .env Variables

Add to the root `.env`:

```env
# Orchestration
OWNER_EMAIL=your@email.com
SCHEDULER_TIMEZONE=America/Chicago
BRIEFING_TIME=08:00
REVIEW_REQUEST_DELAY_HOURS=1

# Alert thresholds
CASH_ALERT_THRESHOLD=2000
LOW_REVENUE_ALERT_PCT=20

# Already required by marketing system
SENDGRID_API_KEY=your_key
MARKETING_FROM_EMAIL=hello@yourbusiness.com
MARKETING_FROM_NAME=Your Business Name
REVIEW_LINK=https://g.page/r/your-link
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_FROM_NUMBER=+1XXXXXXXXXX
REFERRAL_REWARD=10
```

---

## Setup (One Time)

```bash
# 1. Install dependencies
pip install -r Orchestration/requirements.txt

# 2. Verify .env has all required variables above

# 3. Test each integration
python Orchestration/tools/integrations/sendgrid_client.py --test
python Orchestration/tools/integrations/twilio_client.py --test

# 4. Run a dry-run of each job manually
python Orchestration/jobs/daily_review_requests.py --dry-run
python Orchestration/jobs/weekly_revenue_report.py --dry-run
python Orchestration/tools/briefing.py --preview

# 5. Start the full system
python Orchestration/tools/run_all.py
```

---

## Running as a Background Service

### Option A: Keep terminal open (simplest)
```bash
python Orchestration/tools/run_all.py
```

### Option B: Windows Task Scheduler
1. Open Task Scheduler → Create Basic Task
2. Trigger: At system startup
3. Action: `python C:\...\Calendar\Orchestration\tools\run_all.py`
4. Set to run whether logged in or not

### Option C: On a server (Render / Railway)
Deploy `run_all.py` as a background worker alongside the existing michael-receptionist backend.
Add to `render.yaml` as a separate worker service.

---

## Monitoring

- All sent events are logged to `.tmp/event_log.csv`
- All job runs are logged to `.tmp/orchestration_log.csv`
- Check logs daily: `python Orchestration/tools/run_all.py --status`
