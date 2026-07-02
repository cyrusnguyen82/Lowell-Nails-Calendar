"""
db.py — Database connection helpers for the Financial API.

Ported as-is from BusinessOS/core/db.py (same shared Postgres DB, same tables).
"""
import os
import sys
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

if getattr(sys, "frozen", False):
    # PyInstaller build: .env ships next to the packaged executable.
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
load_dotenv(os.path.join(BASE_DIR, ".env"))


def get_db():
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL not set in .env")
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return psycopg2.connect(url, cursor_factory=psycopg2.extras.RealDictCursor)


def get_company(cur) -> dict:
    cur.execute("SELECT * FROM companies LIMIT 1")
    return dict(cur.fetchone() or {})


def get_active_modules(cur, company_id: int) -> set:
    cur.execute(
        "SELECT module FROM module_licenses WHERE company_id = %s AND enabled = TRUE",
        (company_id,)
    )
    return {r["module"] for r in cur.fetchall()}
