# Workflow 06: Employee Time Clock

## Objective
Allow technicians and W-2 employees to clock in/out from a shared tablet. Give the admin full edit rights over any time entry. Feed hours into the monthly payroll report automatically.

---

## Required .env Variables

| Variable | Example | Notes |
|---|---|---|
| `DATABASE_URL` | `postgres://...` | Already set |
| `ADMIN_PIN` | `8421` | Change from default `1234` |
| `SCHEDULER_TIMEZONE` | `America/Los_Angeles` | Already set |
| `BUSINESS_NAME` | `Luxury Nails` | Already set |

---

## One-Time Setup

### Step 1 — Create the database table
```bash
python Financial/tools/time_clock_migrate.py
```
Output: `time_entries table ready.`

### Step 2 — Set your admin PIN in .env
```
ADMIN_PIN=yourpin
```

### Step 3 — Install Flask (if not done)
```bash
pip install -r Orchestration/requirements.txt
```

### Step 4 — Start the server
```bash
python Financial/tools/time_clock_server.py
```
The server runs at `http://0.0.0.0:5000` by default, which makes it accessible to any device on your WiFi.

**Find your local IP** (on the server machine):
- Windows: `ipconfig` → look for "IPv4 Address" under your WiFi adapter
- Example: `192.168.1.42`

**Tell your tablet to open:** `http://192.168.1.42:5000`

---

## Daily Usage

### For Technicians (shared tablet)
1. Open the time clock page in the browser
2. Find your name
3. Tap **Clock In** when you start, **Clock Out** when you leave
4. The card shows how long you've been working

### For Admin (edit time entries)
1. Tap the **Admin** link at the bottom of the clock page
2. Enter your PIN
3. From the admin panel you can:
   - **Add a manual entry** (forgot to clock in, etc.)
   - **Edit any entry** — clock-in time, clock-out time, break minutes, notes
   - **Navigate weeks** using the Prev/Next Week arrows
   - Every edit is stamped with the admin's name

---

## Setting Up Hourly / Hybrid Pay

By default all technicians are treated as commission-only. To mark someone as hourly or hybrid, add them to `.tmp/payroll_overrides.csv`.

**Required CSV columns:**
```
technician_id,commission_rate,model,tiers,pay_type,hourly_rate
```

| `pay_type` | What it means |
|---|---|
| `commission` | Commission only (default, no hourly) |
| `hourly` | Hourly only (no commission) |
| `hybrid` | Both commission + hourly pay |

**Example:**
```csv
technician_id,commission_rate,model,tiers,pay_type,hourly_rate
1,0.45,flat,,commission,0
2,0.00,flat,,hourly,18.00
3,0.30,flat,,hybrid,12.00
```

The monthly payroll report will automatically pull hours from the `time_entries` table and apply the correct pay model per employee.

---

## Running as a Background Service (optional)

To keep the time clock running even if you close the terminal:

**Windows — start on login via Task Scheduler:**
1. Open Task Scheduler → Create Basic Task
2. Trigger: "When I log on"
3. Action: Start a program
   - Program: `python`
   - Arguments: `Financial/tools/time_clock_server.py`
   - Start in: `C:\Users\Cyrus\Desktop\Personal\2026\Calendar`

Or run it alongside the main orchestrator:
```bash
# Start both in separate terminal windows
python Orchestration/tools/run_all.py
python Financial/tools/time_clock_server.py
```

---

## Payroll Integration

The monthly payroll job (`Orchestration/jobs/monthly_payroll.py`) automatically:
1. Pulls hours worked from `time_entries` for each technician for the prior month
2. Applies the correct pay model (commission / hourly / hybrid) from `payroll_overrides.csv`
3. Reports: Service count | Revenue | Hours | Commission | Hourly | Total Pay

---

## Admin Cheat Sheet

| Task | How |
|---|---|
| Tech forgot to clock in | Admin → Add Manual Entry |
| Tech clocked in at wrong time | Admin → Edit → correct the time |
| Add break time | Admin → Edit → set Break (min) field |
| See weekly hours report | Admin → navigate weeks with arrows |
| Pull monthly hours for payroll | Automatic on the 1st of each month |
