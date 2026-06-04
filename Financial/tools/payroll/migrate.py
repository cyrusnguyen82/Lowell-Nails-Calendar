"""
migrate.py

Creates all payroll-related tables in the existing PostgreSQL database.
Run once before using any payroll tools.

Usage:
    python Financial/tools/payroll/migrate.py
    python Financial/tools/payroll/migrate.py --drop-recreate  (DANGER: deletes all payroll data)
"""

import os
import sys
import argparse
import psycopg2
from dotenv import load_dotenv

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

load_dotenv(os.path.join(ROOT, ".env"))

SCHEMA = """
-- ── Employee payroll configuration ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
    id                          SERIAL PRIMARY KEY,
    technician_id               INTEGER UNIQUE NOT NULL REFERENCES technicians(id),
    employee_type               VARCHAR(20) NOT NULL DEFAULT 'w2',   -- w2 | contractor
    active                      BOOLEAN NOT NULL DEFAULT TRUE,

    -- Tax filing info (W-2 only)
    filing_status               VARCHAR(30) DEFAULT 'single',         -- single | married | head_of_household
    federal_allowances          INTEGER DEFAULT 0,                    -- W-4 allowances (pre-2020 W-4)
    federal_extra_withholding   DECIMAL(8,2) DEFAULT 0,               -- Additional flat withholding per period
    state_code                  CHAR(2),                              -- e.g. CA, TX, FL
    state_allowances            INTEGER DEFAULT 0,
    state_extra_withholding     DECIMAL(8,2) DEFAULT 0,

    -- Pay structure
    pay_basis                   VARCHAR(20) DEFAULT 'hourly',         -- hourly | salary | commission | hybrid
    hourly_rate                 DECIMAL(8,2) DEFAULT 0,
    salary_annual               DECIMAL(10,2) DEFAULT 0,
    commission_rate             DECIMAL(5,4) DEFAULT 0.45,            -- used when pay_basis includes commission

    -- Employer SUTA rate (from your state's annual rate notice; overrides default)
    suta_rate                   DECIMAL(7,6),

    -- Identification (last 4 only — never store full SSN/EIN in this system)
    ssn_last4                   CHAR(4),
    ein                         VARCHAR(20),                          -- contractors who have an EIN

    -- Contact
    email                       VARCHAR(255),

    notes                       TEXT,
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Payroll runs (one record per pay period) ──────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_runs (
    id                  SERIAL PRIMARY KEY,
    pay_period_start    DATE NOT NULL,
    pay_period_end      DATE NOT NULL,
    pay_date            DATE NOT NULL,
    frequency           VARCHAR(20) DEFAULT 'weekly',
    status              VARCHAR(20) DEFAULT 'draft',   -- draft | approved | paid | void
    total_gross         DECIMAL(12,2) DEFAULT 0,
    total_net           DECIMAL(12,2) DEFAULT 0,
    total_employee_tax  DECIMAL(12,2) DEFAULT 0,
    total_employer_tax  DECIMAL(12,2) DEFAULT 0,
    notes               TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── Individual payroll line items ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_entries (
    id                      SERIAL PRIMARY KEY,
    run_id                  INTEGER NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    technician_id           INTEGER NOT NULL REFERENCES technicians(id),
    employee_type           VARCHAR(20) NOT NULL,

    -- Earnings
    hours_worked            DECIMAL(6,2) DEFAULT 0,
    hourly_rate             DECIMAL(8,2) DEFAULT 0,
    regular_pay             DECIMAL(10,2) DEFAULT 0,
    overtime_pay            DECIMAL(10,2) DEFAULT 0,   -- hours > 40 at 1.5x
    commission_pay          DECIMAL(10,2) DEFAULT 0,
    gross_pay               DECIMAL(10,2) NOT NULL,

    -- Employee deductions (W-2 only; zeros for contractors)
    federal_income_tax      DECIMAL(8,2) DEFAULT 0,
    social_security_tax     DECIMAL(8,2) DEFAULT 0,
    medicare_tax            DECIMAL(8,2) DEFAULT 0,
    additional_medicare     DECIMAL(8,2) DEFAULT 0,
    state_income_tax        DECIMAL(8,2) DEFAULT 0,
    state_sdi               DECIMAL(8,2) DEFAULT 0,    -- CA SDI, NY SDI/PFL, NJ SDI, etc.
    federal_extra_wh        DECIMAL(8,2) DEFAULT 0,
    state_extra_wh          DECIMAL(8,2) DEFAULT 0,
    total_deductions        DECIMAL(10,2) DEFAULT 0,

    -- Employer taxes (W-2 only)
    employer_ss             DECIMAL(8,2) DEFAULT 0,
    employer_medicare       DECIMAL(8,2) DEFAULT 0,
    employer_futa           DECIMAL(8,2) DEFAULT 0,
    employer_suta           DECIMAL(8,2) DEFAULT 0,
    total_employer_tax      DECIMAL(10,2) DEFAULT 0,

    net_pay                 DECIMAL(10,2) NOT NULL,

    -- YTD snapshots at time of this run (used for W-2 / 1099 prep)
    ytd_gross               DECIMAL(12,2) DEFAULT 0,
    ytd_federal_tax         DECIMAL(10,2) DEFAULT 0,
    ytd_ss_wages            DECIMAL(12,2) DEFAULT 0,
    ytd_ss_tax              DECIMAL(10,2) DEFAULT 0,
    ytd_medicare_tax        DECIMAL(10,2) DEFAULT 0,
    ytd_state_tax           DECIMAL(10,2) DEFAULT 0,
    ytd_sdi                 DECIMAL(10,2) DEFAULT 0,

    created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tax deposit tracker ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tax_deposits (
    id              SERIAL PRIMARY KEY,
    deposit_type    VARCHAR(40) NOT NULL,    -- 941_deposit | 940_annual | suta_q1..q4 | state_income
    tax_period      VARCHAR(20),             -- e.g. 2026-Q1 or 2026
    due_date        DATE NOT NULL,
    estimated_amt   DECIMAL(10,2),
    paid_date       DATE,
    paid_amt        DECIMAL(10,2),
    status          VARCHAR(20) DEFAULT 'pending',  -- pending | paid | late
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_tech     ON employees(technician_id);
CREATE INDEX IF NOT EXISTS idx_pr_entries_run     ON payroll_entries(run_id);
CREATE INDEX IF NOT EXISTS idx_pr_entries_tech    ON payroll_entries(technician_id);
CREATE INDEX IF NOT EXISTS idx_pr_runs_period     ON payroll_runs(pay_period_start, pay_period_end);
CREATE INDEX IF NOT EXISTS idx_tax_deposits_due   ON tax_deposits(due_date, status);
"""

DROP_SCHEMA = """
DROP TABLE IF EXISTS tax_deposits CASCADE;
DROP TABLE IF EXISTS payroll_entries CASCADE;
DROP TABLE IF EXISTS payroll_runs CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
"""


def run(drop_recreate: bool = False):
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL not set in .env")
        sys.exit(1)

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    if drop_recreate:
        confirm = input("This will DELETE all payroll data. Type YES to confirm: ")
        if confirm.strip() != "YES":
            print("Aborted.")
            return
        cur.execute(DROP_SCHEMA)
        print("Existing payroll tables dropped.")

    cur.execute(SCHEMA)
    conn.commit()
    cur.close()
    conn.close()
    print("Payroll tables ready: employees, payroll_runs, payroll_entries, tax_deposits")


def main():
    parser = argparse.ArgumentParser(description="Create payroll database tables.")
    parser.add_argument("--drop-recreate", action="store_true",
                        help="Drop and recreate all payroll tables (DELETES DATA)")
    args = parser.parse_args()
    run(drop_recreate=args.drop_recreate)


if __name__ == "__main__":
    main()
