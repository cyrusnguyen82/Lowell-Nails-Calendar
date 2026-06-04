# BusinessOS — Setup Guide

## Quick Start (Michigan Testing — Your Setup)

You already have Calendar + michael-receptionist on Render with a shared PostgreSQL database.
BusinessOS connects to that same database so it sees your existing technicians and transactions.

```
Step 1 — Add to your .env (at Calendar/.env)
    DATABASE_URL=<your Render PostgreSQL URL>
    EMPLOYER_STATE=MI
    EMPLOYER_EIN=XX-XXXXXXX
    FLASK_SECRET_KEY=<run: python -c "import secrets; print(secrets.token_hex(32))">
    SCHEDULER_TIMEZONE=America/Detroit

Step 2 — Install dependencies
    cd Calendar/BusinessOS
    pip install -r requirements.txt

Step 3 — Run migration (adds BusinessOS tables to your existing Render DB)
    python BusinessOS/core/migrate.py --setup

Step 4 — Start the app
    Double-click START.bat   (localhost only)
    Double-click START_LAN.bat  (LAN mode — employees can use tablets)

Step 5 — Open browser
    http://localhost:8000
```

---

## Prerequisites

- Python 3.11+
- PostgreSQL 14+ (running locally or on a server)
- The existing `Calendar` project database (same DB used by `michael-receptionist`)

---

## 1. Install Dependencies

```bash
cd Calendar/BusinessOS
pip install -r requirements.txt
```

---

## 2. Configure Environment Variables

All credentials live in the shared `.env` file at `Calendar/.env`. Add these variables if not already present:

```env
# PostgreSQL connection (same DB as michael-receptionist)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_database_name
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# Payroll employer info (used on tax reports and pay stubs)
EMPLOYER_STATE=TX
EMPLOYER_EIN=12-3456789

# Business contact
OWNER_EMAIL=owner@yourbusiness.com

# Time clock & review
ADMIN_PIN=1234
REVIEW_LINK=https://g.page/r/your-review-link

# Timezone for time clock display
SCHEDULER_TIMEZONE=America/Los_Angeles
```

---

## 3. Run the Database Migration

This creates all BusinessOS tables alongside existing ones. Safe to run on an existing database — uses `CREATE TABLE IF NOT EXISTS`.

```bash
cd Calendar/BusinessOS
python core/migrate.py --setup
```

The `--setup` flag will prompt you for:
- Business name, state, EIN, timezone
- Admin username and password

To reset (drops and recreates all BusinessOS tables):
```bash
python core/migrate.py --drop-recreate
```

---

## 4. Start the App

```bash
cd Calendar/BusinessOS
python app.py
```

Default: `http://localhost:5001`

Options:
```bash
python app.py --port 8080 --debug
python app.py --host 0.0.0.0 --port 5001
```

---

## 5. First Login

Go to `http://localhost:5001` and sign in with the admin credentials you set during `--setup`.

---

## 6. Module Activation

All 4 modules are enabled by default. To manage which modules a client has access to:

1. Go to **Settings → Module Licenses**
2. Toggle modules on/off
3. Disabled modules disappear from the sidebar automatically

**Available modules:**
| Module | Path | Sell Price |
|--------|------|-----------|
| Payroll & Tax | `/payroll` | Core |
| Time Clock | `/timeclock` | Add-on |
| Financial Dashboard | `/financial` | Add-on |
| Marketing & CRM | (future) | Add-on |

---

## 7. Time Clock — Public Tablet Setup

The time clock page at `/timeclock` requires **no login** — designed for a shared tablet.

To open it automatically on startup (Windows):
1. Create a shortcut to Chrome: `chrome.exe --kiosk http://localhost:5001/timeclock`
2. Add the shortcut to `shell:startup`

To open in kiosk mode (fullscreen, no browser chrome):
```
chrome.exe --kiosk --app=http://localhost:5001/timeclock
```

---

## 8. Database Backups

Create a backup at any time:
- **Web UI**: Settings → Database Backup → Create Backup
- **CLI**: `python core/backup.py --create`

Backups are stored at `Calendar/BusinessOS/.backups/` as gzip-compressed `.sql.gz` files and logged to the `backup_log` table.

Restore from backup:
```bash
python core/backup.py --restore businessos_backup_2026-01-15_manual.sql.gz
```

**Recommended:** Set up a daily auto-backup using Windows Task Scheduler:
```
Action: python C:\path\to\Calendar\BusinessOS\core\backup.py --create
Trigger: Daily at 2:00 AM
```

---

## 9. Running Payroll

1. First, set up employees: **Payroll → Employees → Add Employee**
   - Link each technician to an employee record
   - Set pay basis (hourly, salary, commission, hybrid)
   - Set W-4 info for W-2 employees (filing status, allowances)

2. Make sure technicians clock in/out each week via the Time Clock

3. Each week: **Payroll → Run Payroll**
   - Select the pay period (defaults to prior week)
   - Preview to see all computed gross, taxes, and net pay
   - Confirm to save as a draft run
   - Print pay stubs from the run
   - Mark as Paid when checks/direct deposit are sent

4. Quarterly: **Payroll → Tax Reports → Form 941**
   - Export data to prepare your 941 filing

5. Annually: Generate W-2 and 1099-NEC data for your accountant

---

## 10. Selling to Clients (Deployment)

Each client gets their own installation:

1. Clone the `Calendar` repo to the client's machine
2. Set up a new PostgreSQL database
3. Configure `.env` with client-specific credentials
4. Run `python core/migrate.py --setup` with client's business info
5. Start the app and give them the admin login

To sell individual modules only, disable unused modules in Settings after setup.

**No code changes needed** — the module system handles everything at the database level.

---

## Troubleshooting

**App won't start — database connection error**
- Check `.env` DB credentials
- Ensure PostgreSQL is running: `pg_ctl status`
- Test connection: `psql -U your_user -d your_db`

**"Table does not exist" errors**
- Run migration: `python core/migrate.py --setup`

**Payroll preview shows $0 for all employees**
- Ensure employees are linked (Payroll → Employees)
- Check that time entries exist for the selected pay period
- For commission-based: check that transactions are recorded for the period

**Time clock not showing technicians**
- Technicians must exist in the `technicians` table (from the main Calendar app)
- The `timeclock` module must be enabled (Settings → Module Licenses)

**Backup fails**
- Ensure `pg_dump` is in your PATH: `pg_dump --version`
- On Windows, add PostgreSQL `bin/` to system PATH
