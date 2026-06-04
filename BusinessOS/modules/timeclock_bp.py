"""
timeclock_bp.py — Time Clock module Blueprint
"""
import os, sys
from datetime import date, timedelta, datetime, timezone
from zoneinfo import ZoneInfo
from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for, flash

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from BusinessOS.core.db import get_db, get_company, get_active_modules, fmt_currency
from BusinessOS.core.auth import login_required, module_required

timeclock_bp = Blueprint("timeclock", __name__, template_folder="../templates")

TZ_NAME = os.getenv("SCHEDULER_TIMEZONE", "America/Los_Angeles")


def _calc_hours(clock_in, clock_out, break_min):
    if not clock_out: return None
    ci = clock_in  if clock_in.tzinfo  else clock_in.replace(tzinfo=timezone.utc)
    co = clock_out if clock_out.tzinfo else clock_out.replace(tzinfo=timezone.utc)
    return round(max((co - ci).total_seconds() - break_min * 60, 0) / 3600, 2)


def _fmt_dur(clock_in_utc):
    if not clock_in_utc: return ""
    now = datetime.now(timezone.utc)
    ci  = clock_in_utc if clock_in_utc.tzinfo else clock_in_utc.replace(tzinfo=timezone.utc)
    d   = int((now - ci).total_seconds())
    return f"{d//3600}h {(d%3600)//60:02d}m"


@timeclock_bp.route("/")
@module_required("timeclock")
def index():
    """Public clock-in page — no login required (shared tablet)."""
    conn = get_db(); cur = conn.cursor()
    company = get_company(cur)
    cur.execute("SELECT id, first_name, last_name FROM technicians ORDER BY first_name")
    techs_raw = cur.fetchall()
    cur.execute("""
        SELECT DISTINCT ON (technician_id) id AS entry_id, technician_id, clock_in
        FROM time_entries WHERE clock_out IS NULL ORDER BY technician_id, clock_in DESC
    """)
    active = {r["technician_id"]: r for r in cur.fetchall()}
    cur.close(); conn.close()

    techs = []
    for t in techs_raw:
        a = active.get(t["id"])
        techs.append({
            "id": t["id"],
            "first_name": t["first_name"],
            "last_name":  t["last_name"],
            "entry_id":   a["entry_id"] if a else None,
            "duration":   _fmt_dur(a["clock_in"]) if a else "",
        })
    return render_template("timeclock/index.html", company=company, techs=techs, page="timeclock")


@timeclock_bp.route("/api/clock-in", methods=["POST"])
def api_clock_in():
    data    = request.get_json()
    tech_id = data.get("tech_id")
    conn    = get_db(); cur = conn.cursor()
    cur.execute("SELECT id FROM time_entries WHERE technician_id=%s AND clock_out IS NULL", (tech_id,))
    if cur.fetchone():
        cur.close(); conn.close()
        return jsonify({"success": False, "error": "Already clocked in"})
    cur.execute("INSERT INTO time_entries (technician_id, clock_in) VALUES (%s, NOW())", (tech_id,))
    conn.commit(); cur.close(); conn.close()
    return jsonify({"success": True, "message": "Clocked in"})


@timeclock_bp.route("/api/clock-out", methods=["POST"])
def api_clock_out():
    data    = request.get_json()
    tech_id = data.get("tech_id")
    conn    = get_db(); cur = conn.cursor()
    cur.execute("""
        SELECT id, clock_in, break_minutes FROM time_entries
        WHERE technician_id=%s AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1
    """, (tech_id,))
    row = cur.fetchone()
    if not row:
        cur.close(); conn.close()
        return jsonify({"success": False, "error": "Not clocked in"})
    now   = datetime.now(timezone.utc)
    hours = _calc_hours(row["clock_in"], now, row["break_minutes"] or 0)
    cur.execute("UPDATE time_entries SET clock_out=%s, hours_worked=%s WHERE id=%s",
                (now, hours, row["id"]))
    conn.commit(); cur.close(); conn.close()
    return jsonify({"success": True, "message": f"Clocked out — {hours:.2f}h"})


@timeclock_bp.route("/admin")
@login_required
@module_required("timeclock")
def admin():
    tz   = ZoneInfo(TZ_NAME)
    conn = get_db(); cur = conn.cursor()
    company = get_company(cur)
    modules = get_active_modules(cur, company["id"])

    week_str = request.args.get("week")
    if week_str:
        try:
            ref = datetime.strptime(week_str, "%Y-%m-%d").date()
        except ValueError:
            ref = date.today()
    else:
        ref = date.today()

    monday = ref - timedelta(days=ref.weekday())
    sunday = monday + timedelta(days=6)
    prev_w = (monday - timedelta(days=7)).isoformat()
    next_w = (monday + timedelta(days=7)).isoformat()

    cur.execute("SELECT id, first_name, last_name FROM technicians ORDER BY first_name")
    techs = [dict(r) for r in cur.fetchall()]

    cur.execute("""
        SELECT te.id, te.technician_id AS tech_id,
               t.first_name, t.last_name,
               te.clock_in, te.clock_out, te.break_minutes,
               te.hours_worked, te.notes, te.edited_by
        FROM time_entries te
        JOIN technicians t ON t.id = te.technician_id
        WHERE te.clock_in::date BETWEEN %s AND %s
        ORDER BY te.clock_in DESC
    """, (monday, sunday))

    entries = []
    total_hours = 0.0
    for r in cur.fetchall():
        row = dict(r)
        ci = r["clock_in"].astimezone(tz) if r["clock_in"] else None
        co = r["clock_out"].astimezone(tz) if r["clock_out"] else None
        row["clock_in_local"]   = ci
        row["clock_out_local"]  = co
        row["clock_in_iso"]     = ci.strftime("%Y-%m-%dT%H:%M") if ci else ""
        row["clock_out_iso"]    = co.strftime("%Y-%m-%dT%H:%M") if co else ""
        entries.append(row)
        if r["hours_worked"]:
            total_hours += float(r["hours_worked"])

    flash_msg = session.pop("tc_flash", None)
    cur.close(); conn.close()

    return render_template("timeclock/admin.html",
        company=company, modules=modules,
        techs=techs, entries=entries, total_hours=round(total_hours,2),
        monday=monday, sunday=sunday,
        week_label=f"{monday.strftime('%b %d')} – {sunday.strftime('%b %d, %Y')}",
        prev_week=prev_w, next_week=next_w,
        flash_msg=flash_msg, page="timeclock",
    )


@timeclock_bp.route("/admin/edit", methods=["POST"])
@login_required
@module_required("timeclock")
def admin_edit():
    tz = ZoneInfo(TZ_NAME)
    f  = request.form
    try:
        entry_id   = int(f["entry_id"])
        ci         = datetime.fromisoformat(f["clock_in"]).replace(tzinfo=tz)
        co_str     = f.get("clock_out","")
        co         = datetime.fromisoformat(co_str).replace(tzinfo=tz) if co_str else None
        brk        = int(f.get("break_minutes",0) or 0)
        notes      = f.get("notes","")
        admin_name = f.get("admin_name","admin")
        hours      = _calc_hours(ci, co, brk)

        conn = get_db(); cur = conn.cursor()
        cur.execute("""
            UPDATE time_entries SET clock_in=%s, clock_out=%s, break_minutes=%s,
                hours_worked=%s, notes=%s, edited_by=%s, edited_at=NOW()
            WHERE id=%s
        """, (ci, co, brk, hours, notes, admin_name, entry_id))
        conn.commit(); cur.close(); conn.close()
        flash(f"Entry #{entry_id} updated by {admin_name}.", "success")
    except Exception as e:
        flash(f"Error: {e}", "danger")
    return redirect(url_for("timeclock.admin"))


@timeclock_bp.route("/admin/add", methods=["POST"])
@login_required
@module_required("timeclock")
def admin_add():
    tz = ZoneInfo(TZ_NAME)
    f  = request.form
    try:
        tech_id = int(f["tech_id"])
        ci  = datetime.fromisoformat(f["clock_in"]).replace(tzinfo=tz)
        co_str = f.get("clock_out","")
        co  = datetime.fromisoformat(co_str).replace(tzinfo=tz) if co_str else None
        brk = int(f.get("break_minutes",0) or 0)
        notes = f.get("notes","")
        hours = _calc_hours(ci, co, brk)

        conn = get_db(); cur = conn.cursor()
        cur.execute("""
            INSERT INTO time_entries (technician_id, clock_in, clock_out, break_minutes, hours_worked, notes)
            VALUES (%s,%s,%s,%s,%s,%s)
        """, (tech_id, ci, co, brk, hours, notes))
        conn.commit(); cur.close(); conn.close()
        flash("Entry added.", "success")
    except Exception as e:
        flash(f"Error: {e}", "danger")
    return redirect(url_for("timeclock.admin"))
