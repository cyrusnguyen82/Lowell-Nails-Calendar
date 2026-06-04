# Workflow: Orchestration Setup

**Objective:** Get the full autonomous system running from zero in under 30 minutes.

**Inputs required:** All `.env` variables from the README, SendGrid account, Twilio account

**Outputs:** A running background process that autonomously handles marketing and financial operations

---

## Step 1: Install Dependencies (2 min)

```bash
pip install -r Orchestration/requirements.txt
```

Verify installation:
```bash
python -c "import apscheduler, sendgrid, twilio; print('All dependencies OK')"
```

---

## Step 2: Configure .env (5 min)

Open the root `.env` file and add all variables listed in `Orchestration/README.md`.

Priority order:
1. `OWNER_EMAIL` — where briefings and reports go. **Required.**
2. `SENDGRID_API_KEY` — without this, no emails send. **Required.**
3. `SCHEDULER_TIMEZONE` — if wrong, jobs fire at the wrong time. **Required.**
4. `TWILIO_*` — needed for SMS review requests. Can skip initially (falls back to email).
5. `CASH_ALERT_THRESHOLD` — set to 3 months of fixed expenses.

---

## Step 3: Get SendGrid Set Up (5 min)

1. Sign up at sendgrid.com (free tier = 100 emails/day)
2. Go to Settings → API Keys → Create API Key (Full Access)
3. Copy key into `.env` as `SENDGRID_API_KEY`
4. Go to Settings → Sender Authentication → verify your `MARKETING_FROM_EMAIL` address
5. Test: `python Orchestration/tools/integrations/sendgrid_client.py --test`

You should receive a test email at `OWNER_EMAIL`.

---

## Step 4: Get Twilio Set Up (5 min)

1. Sign up at twilio.com (trial account gives free credits)
2. Get a phone number from the Twilio console
3. Copy Account SID and Auth Token into `.env`
4. Set `TWILIO_FROM_NUMBER` to your Twilio number (format: +1XXXXXXXXXX)
5. Test: `python Orchestration/tools/integrations/twilio_client.py --test`

You should receive a test SMS on your phone.

**Note:** On Twilio trial, you can only send to verified numbers. Upgrade to a paid account ($15/month) before going live with clients.

---

## Step 5: Dry-Run Each Job (10 min)

Run each job in dry-run mode — it executes all logic but sends nothing:

```bash
python Orchestration/jobs/daily_review_requests.py --dry-run
python Orchestration/jobs/weekly_revenue_report.py --dry-run
python Orchestration/jobs/monthly_reactivation.py --dry-run
python Orchestration/jobs/monthly_payroll.py --dry-run
python Orchestration/jobs/cash_flow_alert.py --dry-run
python Orchestration/tools/briefing.py --preview
```

Review the output of each. Confirm:
- Client data looks correct
- Revenue numbers match what you see in the POS
- Email content reads correctly before it goes to real clients

---

## Step 6: Run the Full System

```bash
python Orchestration/tools/run_all.py
```

You'll see:
```
[Orchestration] Starting scheduler...
[Orchestration] Starting event listener...
[Orchestration] 7 jobs registered.
[Orchestration] System live. Press Ctrl+C to stop.
```

Check that jobs are registered:
```bash
python Orchestration/tools/run_all.py --status
```

---

## Step 7: Set Up Auto-Start (Windows)

So the system restarts automatically after a reboot:

1. Press Win+R → type `taskschd.msc` → Enter
2. Create Basic Task → Name: "Business Orchestration"
3. Trigger: When the computer starts
4. Action: Start a program
   - Program: `python`
   - Arguments: `C:\Users\Cyrus\Desktop\Personal\2026\Calendar\Orchestration\tools\run_all.py`
5. Check: "Run whether user is logged in or not"
6. Check: "Run with highest privileges"

Alternatively, deploy `run_all.py` as a worker on Render alongside michael-receptionist.

---

## Monitoring

Check what's been sent and what fired:
```bash
# View recent event log
python Orchestration/tools/run_all.py --status

# Check last 7 days of events manually
# Open: .tmp/event_log.csv
# Open: .tmp/orchestration_log.csv
```

---

## Turning Off Individual Jobs

To disable a job without stopping the whole system, add to `.env`:

```env
DISABLE_REVIEW_REQUESTS=true
DISABLE_REACTIVATION=true
DISABLE_BRIEFING=false
```

Each job checks its flag before executing.
