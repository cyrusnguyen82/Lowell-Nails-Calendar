"""
migrate.py — BusinessOS master database migration

Creates ALL tables used by every module in a single, idempotent script.
Run this once on a fresh database or after adding a new module.

Usage:
    python BusinessOS/core/migrate.py
    python BusinessOS/core/migrate.py --setup     # also seeds initial company + admin user
"""

import os, sys, argparse, getpass
import psycopg2
from dotenv import load_dotenv

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
load_dotenv(os.path.join(ROOT, ".env"))

SCHEMA = """
-- ════════════════════════════════════════════════════════════
-- CORE / IDENTITY
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS companies (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL DEFAULT 'My Business',
    state       CHAR(2),
    ein         VARCHAR(20),
    address     TEXT,
    phone       VARCHAR(30),
    email       VARCHAR(255),
    logo_url    TEXT,
    timezone    VARCHAR(60) DEFAULT 'America/Los_Angeles',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bos_users (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    username        VARCHAR(100) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(20) DEFAULT 'admin',
    email           VARCHAR(255),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS module_licenses (
    id          SERIAL PRIMARY KEY,
    company_id  INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    module      VARCHAR(50) NOT NULL,   -- payroll | timeclock | financial | marketing
    enabled     BOOLEAN DEFAULT TRUE,
    label       VARCHAR(100),
    price_note  TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (company_id, module)
);

-- ════════════════════════════════════════════════════════════
-- EMPLOYEES & PAYROLL  (Module: payroll)
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS employees (
    id                          SERIAL PRIMARY KEY,
    technician_id               INTEGER UNIQUE NOT NULL REFERENCES technicians(id),
    employee_type               VARCHAR(20) NOT NULL DEFAULT 'w2',
    active                      BOOLEAN NOT NULL DEFAULT TRUE,
    filing_status               VARCHAR(30) DEFAULT 'single',
    federal_allowances          INTEGER DEFAULT 0,
    federal_extra_withholding   DECIMAL(8,2) DEFAULT 0,
    state_code                  CHAR(2),
    state_allowances            INTEGER DEFAULT 0,
    state_extra_withholding     DECIMAL(8,2) DEFAULT 0,
    pay_basis                   VARCHAR(20) DEFAULT 'hourly',
    hourly_rate                 DECIMAL(8,2) DEFAULT 0,
    salary_annual               DECIMAL(10,2) DEFAULT 0,
    commission_rate             DECIMAL(5,4) DEFAULT 0.45,
    suta_rate                   DECIMAL(7,6),
    ssn_last4                   CHAR(4),
    ein                         VARCHAR(20),
    email                       VARCHAR(255),
    notes                       TEXT,
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_runs (
    id                  SERIAL PRIMARY KEY,
    pay_period_start    DATE NOT NULL,
    pay_period_end      DATE NOT NULL,
    pay_date            DATE NOT NULL,
    frequency           VARCHAR(20) DEFAULT 'weekly',
    status              VARCHAR(20) DEFAULT 'draft',
    total_gross         DECIMAL(12,2) DEFAULT 0,
    total_net           DECIMAL(12,2) DEFAULT 0,
    total_employee_tax  DECIMAL(12,2) DEFAULT 0,
    total_employer_tax  DECIMAL(12,2) DEFAULT 0,
    notes               TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_entries (
    id                      SERIAL PRIMARY KEY,
    run_id                  INTEGER NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    technician_id           INTEGER NOT NULL REFERENCES technicians(id),
    employee_type           VARCHAR(20) NOT NULL,
    hours_worked            DECIMAL(6,2) DEFAULT 0,
    hourly_rate             DECIMAL(8,2) DEFAULT 0,
    regular_pay             DECIMAL(10,2) DEFAULT 0,
    overtime_pay            DECIMAL(10,2) DEFAULT 0,
    commission_pay          DECIMAL(10,2) DEFAULT 0,
    gross_pay               DECIMAL(10,2) NOT NULL,
    federal_income_tax      DECIMAL(8,2) DEFAULT 0,
    social_security_tax     DECIMAL(8,2) DEFAULT 0,
    medicare_tax            DECIMAL(8,2) DEFAULT 0,
    additional_medicare     DECIMAL(8,2) DEFAULT 0,
    state_income_tax        DECIMAL(8,2) DEFAULT 0,
    state_sdi               DECIMAL(8,2) DEFAULT 0,
    federal_extra_wh        DECIMAL(8,2) DEFAULT 0,
    state_extra_wh          DECIMAL(8,2) DEFAULT 0,
    total_deductions        DECIMAL(10,2) DEFAULT 0,
    employer_ss             DECIMAL(8,2) DEFAULT 0,
    employer_medicare       DECIMAL(8,2) DEFAULT 0,
    employer_futa           DECIMAL(8,2) DEFAULT 0,
    employer_suta           DECIMAL(8,2) DEFAULT 0,
    total_employer_tax      DECIMAL(10,2) DEFAULT 0,
    net_pay                 DECIMAL(10,2) NOT NULL,
    ytd_gross               DECIMAL(12,2) DEFAULT 0,
    ytd_federal_tax         DECIMAL(10,2) DEFAULT 0,
    ytd_ss_wages            DECIMAL(12,2) DEFAULT 0,
    ytd_ss_tax              DECIMAL(10,2) DEFAULT 0,
    ytd_medicare_tax        DECIMAL(10,2) DEFAULT 0,
    ytd_state_tax           DECIMAL(10,2) DEFAULT 0,
    ytd_sdi                 DECIMAL(10,2) DEFAULT 0,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tax_deposits (
    id              SERIAL PRIMARY KEY,
    deposit_type    VARCHAR(40) NOT NULL,
    tax_period      VARCHAR(20),
    due_date        DATE NOT NULL,
    estimated_amt   DECIMAL(10,2),
    paid_date       DATE,
    paid_amt        DECIMAL(10,2),
    status          VARCHAR(20) DEFAULT 'pending',
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- TIME CLOCK  (Module: timeclock)
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS time_entries (
    id              SERIAL PRIMARY KEY,
    technician_id   INTEGER NOT NULL REFERENCES technicians(id),
    clock_in        TIMESTAMPTZ NOT NULL,
    clock_out       TIMESTAMPTZ,
    break_minutes   INTEGER NOT NULL DEFAULT 0,
    hours_worked    DECIMAL(6,2),
    notes           TEXT,
    edited_by       TEXT,
    edited_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- FINANCIAL  (Module: financial)
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS expenses (
    id              SERIAL PRIMARY KEY,
    amount          DECIMAL(10,2) NOT NULL,
    category        VARCHAR(50),
    note            TEXT,
    expense_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    recurring       BOOLEAN DEFAULT FALSE,
    personal        BOOLEAN DEFAULT FALSE,
    vendor          VARCHAR(100),
    receipt_url     TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- MARKETING / CRM  (Module: marketing)
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS event_log (
    id              SERIAL PRIMARY KEY,
    event_type      VARCHAR(60) NOT NULL,
    entity_id       INTEGER,
    channel         VARCHAR(20),
    recipient       VARCHAR(255),
    status          VARCHAR(20),
    note            TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referral_codes (
    id              SERIAL PRIMARY KEY,
    client_id       INTEGER REFERENCES clients(id),
    code            VARCHAR(20) UNIQUE NOT NULL,
    referred_count  INTEGER DEFAULT 0,
    reward_pending  DECIMAL(8,2) DEFAULT 0,
    reward_paid     DECIMAL(8,2) DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- BACKUPS LOG
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS backup_log (
    id          SERIAL PRIMARY KEY,
    filename    VARCHAR(255),
    size_bytes  BIGINT,
    type        VARCHAR(20) DEFAULT 'manual',   -- manual | scheduled
    status      VARCHAR(20) DEFAULT 'success',
    notes       TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- INDEXES
-- ════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_employees_tech       ON employees(technician_id);
CREATE INDEX IF NOT EXISTS idx_pr_entries_run       ON payroll_entries(run_id);
CREATE INDEX IF NOT EXISTS idx_pr_entries_tech      ON payroll_entries(technician_id);
CREATE INDEX IF NOT EXISTS idx_pr_runs_period       ON payroll_runs(pay_period_start);
CREATE INDEX IF NOT EXISTS idx_time_entries_tech    ON time_entries(technician_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_in      ON time_entries(clock_in);
CREATE INDEX IF NOT EXISTS idx_expenses_date        ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_event_log_type       ON event_log(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_module_licenses_co   ON module_licenses(company_id);
"""

# Columns added after initial release — safe to run on existing databases
MIGRATIONS = """
-- Renamed from 'users' to avoid conflict with shared Calendar database
CREATE TABLE IF NOT EXISTS bos_users (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    username        VARCHAR(100) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(20) DEFAULT 'admin',
    email           VARCHAR(255),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- technicians table uses 'name' column; add first_name/last_name for BusinessOS
ALTER TABLE technicians
    ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS last_name  TEXT NOT NULL DEFAULT '';

UPDATE technicians
SET first_name = COALESCE(split_part(name, ' ', 1), name),
    last_name  = COALESCE(NULLIF(trim(regexp_replace(name, E'^\\S+\\s*', '')), ''), '')
WHERE first_name = '';

-- time_entries exists from michael-receptionist but is missing BusinessOS columns
ALTER TABLE time_entries
    ADD COLUMN IF NOT EXISTS break_minutes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS hours_worked  DECIMAL(6,2),
    ADD COLUMN IF NOT EXISTS notes         TEXT,
    ADD COLUMN IF NOT EXISTS edited_by     TEXT,
    ADD COLUMN IF NOT EXISTS edited_at     TIMESTAMPTZ;

-- appointments JSONB columns (added by michael-receptionist but may be missing on older DBs)
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS services          JSONB;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS tech_requested    BOOLEAN DEFAULT FALSE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS client_confirmed  BOOLEAN DEFAULT FALSE;

ALTER TABLE employees
    ADD COLUMN IF NOT EXISTS city_code     VARCHAR(30),
    ADD COLUMN IF NOT EXISTS city_resident BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE payroll_entries
    ADD COLUMN IF NOT EXISTS city_income_tax  DECIMAL(8,2)  NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS ytd_city_tax     DECIMAL(10,2) NOT NULL DEFAULT 0;
"""

DEFAULT_MODULES = [
    ("payroll",    "Payroll & Tax",       "Includes W-2, 1099, tax withholding, pay stubs, 941/940/W-2 reports"),
    ("timeclock",  "Time Clock",          "Employee clock-in/out, timesheet admin, overtime tracking"),
    ("financial",  "Financial Dashboard", "Expense tracking, cash flow, P&L reports, revenue dashboard"),
    ("marketing",  "Marketing & CRM",     "Reactivation campaigns, review requests, referral tracking"),
]


def run(setup: bool = False):
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL not set in .env")
        sys.exit(1)

    # Render uses postgres:// but psycopg2 requires postgresql://
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    conn = psycopg2.connect(db_url)
    cur  = conn.cursor()
    cur.execute(SCHEMA)
    cur.execute(MIGRATIONS)
    conn.commit()
    print("All BusinessOS tables created/updated (Michigan city tax columns included).")

    if setup:
        # Company record
        cur.execute("SELECT id FROM companies LIMIT 1")
        company = cur.fetchone()
        if not company:
            name  = input("Business name: ").strip() or "My Business"
            state = input("State (2-letter code, e.g. CA): ").strip().upper() or "CA"
            ein   = input("EIN (12-3456789, or press Enter to skip): ").strip()
            tz    = input("Timezone (e.g. America/Los_Angeles): ").strip() or "America/Los_Angeles"
            cur.execute(
                "INSERT INTO companies (name, state, ein, timezone) VALUES (%s,%s,%s,%s) RETURNING id",
                (name, state, ein or None, tz)
            )
            company_id = cur.fetchone()[0]
            print(f"Company '{name}' created (id={company_id})")
        else:
            company_id = company[0]
            print(f"Company record already exists (id={company_id})")

        # Module licenses
        for mod, label, price_note in DEFAULT_MODULES:
            cur.execute("""
                INSERT INTO module_licenses (company_id, module, label, price_note)
                VALUES (%s,%s,%s,%s)
                ON CONFLICT (company_id, module) DO NOTHING
            """, (company_id, mod, label, price_note))
        print("All modules enabled by default.")

        # Admin user
        cur.execute("SELECT id FROM bos_users LIMIT 1")
        if not cur.fetchone():
            import bcrypt
            uname = input("Admin username (default: admin): ").strip() or "admin"
            pw    = getpass.getpass("Admin password: ")
            pw2   = getpass.getpass("Confirm password: ")
            if pw != pw2:
                print("Passwords do not match. Re-run --setup to try again.")
            else:
                hashed = bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
                cur.execute(
                    "INSERT INTO bos_users (company_id, username, password_hash, role) VALUES (%s,%s,%s,'admin')",
                    (company_id, uname, hashed)
                )
                print(f"Admin user '{uname}' created.")
        else:
            print("Admin user already exists.")

        conn.commit()
        print("\nSetup complete. Run: python BusinessOS/app.py")

    cur.close()
    conn.close()


def main():
    parser = argparse.ArgumentParser(description="BusinessOS database migration.")
    parser.add_argument("--setup", action="store_true",
                        help="Also seed initial company, modules, and admin user.")
    args = parser.parse_args()
    run(setup=args.setup)


if __name__ == "__main__":
    main()
