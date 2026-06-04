"""
calendar_bp.py — Salon Calendar module Blueprint
Full-featured appointment calendar pulling from the shared database.
"""
import os, sys, json
from datetime import date, datetime, timedelta
from flask import Blueprint, render_template, request, jsonify, session

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from BusinessOS.core.db import get_db, get_company, get_active_modules
from BusinessOS.core.auth import login_required

calendar_bp = Blueprint("calendar", __name__, template_folder="../templates")


def _serialize_apt(row):
    d = dict(row)
    services = d.get("services")
    if isinstance(services, str):
        try:
            services = json.loads(services)
        except Exception:
            services = None
    d["services"] = services or []
    d["techRequested"]   = d.pop("tech_requested", False) or False
    d["clientConfirmed"] = d.pop("client_confirmed", False) or False
    d["startTime"]       = d.pop("start_time")
    d["technicianId"]    = d.pop("technician_id")
    d["clientName"]      = d.pop("client_name")
    d["clientPhone"]     = d.pop("client_phone", "") or ""
    return d


@calendar_bp.route("/")
@login_required
def index():
    conn = get_db(); cur = conn.cursor()
    company = get_company(cur)
    company_id = session.get("company_id") or 1
    modules = get_active_modules(cur, company_id)
    if not modules:
        modules = {"payroll", "timeclock", "financial", "marketing", "calendar"}
    cur.execute("SELECT id, name, color, initials FROM technicians ORDER BY id")
    techs = [dict(r) for r in cur.fetchall()]
    cur.close(); conn.close()
    today = date.today().isoformat()
    return render_template("calendar/index.html",
        company=company, modules=modules, techs=techs, today=today, page="calendar")


@calendar_bp.route("/api/appointments")
@login_required
def api_appointments():
    day = request.args.get("date", date.today().isoformat())
    conn = get_db(); cur = conn.cursor()
    cur.execute("""
        SELECT a.id, a.technician_id, a.client_name, a.client_phone,
               a.service, a.date, a.start_time, a.duration, a.notes, a.status,
               a.services, a.tech_requested, a.client_confirmed
        FROM appointments a
        WHERE a.date = %s
        ORDER BY a.start_time, a.id
    """, (day,))
    apts = [_serialize_apt(r) for r in cur.fetchall()]
    cur.close(); conn.close()
    return jsonify(apts)


@calendar_bp.route("/api/appointments/week")
@login_required
def api_appointments_week():
    start = request.args.get("start", date.today().isoformat())
    try:
        d0 = datetime.strptime(start, "%Y-%m-%d").date()
    except ValueError:
        d0 = date.today()
    dates = [(d0 + timedelta(days=i)).isoformat() for i in range(7)]
    conn = get_db(); cur = conn.cursor()
    cur.execute("""
        SELECT a.id, a.technician_id, a.client_name, a.client_phone,
               a.service, a.date, a.start_time, a.duration, a.notes, a.status,
               a.services, a.tech_requested, a.client_confirmed
        FROM appointments a
        WHERE a.date = ANY(%s)
        ORDER BY a.date, a.start_time, a.id
    """, (dates,))
    apts = [_serialize_apt(r) for r in cur.fetchall()]
    cur.close(); conn.close()
    return jsonify(apts)


@calendar_bp.route("/api/appointments/month")
@login_required
def api_appointments_month():
    month = request.args.get("month", date.today().strftime("%Y-%m"))
    conn = get_db(); cur = conn.cursor()
    cur.execute("""
        SELECT date, COUNT(*) AS count
        FROM appointments
        WHERE date LIKE %s
        GROUP BY date
    """, (month + "-%",))
    counts = {r["date"]: r["count"] for r in cur.fetchall()}
    cur.close(); conn.close()
    return jsonify(counts)


@calendar_bp.route("/api/appointments", methods=["POST"])
@login_required
def api_create_appointment():
    d = request.get_json()
    conn = get_db(); cur = conn.cursor()
    services_json = json.dumps(d.get("services", [])) if d.get("services") else None
    cur.execute("""
        INSERT INTO appointments
            (technician_id, client_name, client_phone, service, date,
             start_time, duration, notes, status, services, tech_requested, client_confirmed)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        RETURNING id
    """, (
        d.get("technicianId"),
        d.get("clientName","").strip(),
        d.get("clientPhone","").strip() or None,
        d.get("service","").strip(),
        d.get("date"),
        d.get("startTime","09:00"),
        int(d.get("duration", 60)),
        d.get("notes","").strip() or None,
        d.get("status","confirmed"),
        services_json,
        bool(d.get("techRequested", False)),
        bool(d.get("clientConfirmed", False)),
    ))
    new_id = cur.fetchone()["id"]
    conn.commit(); cur.close(); conn.close()
    return jsonify({"success": True, "id": new_id})


@calendar_bp.route("/api/appointments/<int:apt_id>", methods=["PUT"])
@login_required
def api_update_appointment(apt_id):
    d = request.get_json()
    conn = get_db(); cur = conn.cursor()
    services_json = json.dumps(d.get("services", [])) if d.get("services") else None
    cur.execute("""
        UPDATE appointments SET
            technician_id=%s, client_name=%s, client_phone=%s, service=%s,
            date=%s, start_time=%s, duration=%s, notes=%s, status=%s,
            services=%s, tech_requested=%s, client_confirmed=%s
        WHERE id=%s
    """, (
        d.get("technicianId"),
        d.get("clientName","").strip(),
        d.get("clientPhone","").strip() or None,
        d.get("service","").strip(),
        d.get("date"),
        d.get("startTime","09:00"),
        int(d.get("duration", 60)),
        d.get("notes","").strip() or None,
        d.get("status","confirmed"),
        services_json,
        bool(d.get("techRequested", False)),
        bool(d.get("clientConfirmed", False)),
        apt_id,
    ))
    conn.commit(); cur.close(); conn.close()
    return jsonify({"success": True})


@calendar_bp.route("/api/appointments/<int:apt_id>", methods=["DELETE"])
@login_required
def api_delete_appointment(apt_id):
    conn = get_db(); cur = conn.cursor()
    cur.execute("DELETE FROM appointments WHERE id=%s", (apt_id,))
    conn.commit(); cur.close(); conn.close()
    return jsonify({"success": True})


@calendar_bp.route("/api/clients/search")
@login_required
def api_clients_search():
    q = request.args.get("q", "").strip()
    if len(q) < 2:
        return jsonify([])
    conn = get_db(); cur = conn.cursor()
    cur.execute("""
        SELECT id, first_name, last_name, phone FROM clients
        WHERE first_name ILIKE %s OR last_name ILIKE %s OR phone LIKE %s
        ORDER BY first_name LIMIT 8
    """, (f"%{q}%", f"%{q}%", f"%{q}%"))
    clients = [dict(r) for r in cur.fetchall()]
    cur.close(); conn.close()
    return jsonify(clients)
