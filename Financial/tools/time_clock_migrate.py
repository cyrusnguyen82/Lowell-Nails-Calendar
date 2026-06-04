"""
time_clock_migrate.py

Creates the time_entries table in the existing PostgreSQL database.
Run once before starting the time clock server.

Usage:
    python Financial/tools/time_clock_migrate.py
"""

import os
import sys
import psycopg2
from dotenv import load_dotenv

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

load_dotenv(os.path.join(ROOT, ".env"))

CREATE_TABLE = """
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

CREATE INDEX IF NOT EXISTS idx_time_entries_tech_id ON time_entries(technician_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_clock_in ON time_entries(clock_in);
"""


def run():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL not set in .env")
        sys.exit(1)

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    cur.execute(CREATE_TABLE)
    conn.commit()
    cur.close()
    conn.close()
    print("time_entries table ready.")


if __name__ == "__main__":
    run()
