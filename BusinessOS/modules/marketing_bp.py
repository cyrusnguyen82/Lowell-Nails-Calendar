"""
marketing_bp.py — Marketing & CRM module Blueprint (placeholder)
"""
import os, sys
from flask import Blueprint, render_template, session

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from BusinessOS.core.db import get_db, get_company, get_active_modules
from BusinessOS.core.auth import login_required, module_required

marketing_bp = Blueprint("marketing", __name__, template_folder="../templates")


@marketing_bp.route("/")
@login_required
@module_required("marketing")
def index():
    conn = get_db(); cur = conn.cursor()
    company = get_company(cur)
    company_id = session.get("company_id") or 1
    modules = get_active_modules(cur, company_id)
    if not modules:
        modules = {"payroll", "timeclock", "financial", "marketing"}
    cur.close(); conn.close()
    return render_template("marketing/index.html", company=company, modules=modules, page="marketing")
