"""
db.py — Database connection helpers for BusinessOS
"""
import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
load_dotenv(os.path.join(ROOT, ".env"))


def get_db():
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL not set in .env")
    # Render supplies postgres:// but psycopg2 requires postgresql://
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


def fmt_currency(n) -> str:
    return f"${float(n or 0):,.2f}"
