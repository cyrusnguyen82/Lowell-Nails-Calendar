"""
time_clock_server.py

Lightweight web app for employee time clock.
Runs on a shared tablet or PC on your local network.

Usage:
    python Financial/tools/time_clock_server.py
    python Financial/tools/time_clock_server.py --port 5001
    python Financial/tools/time_clock_server.py --host 0.0.0.0 --port 5000

Required .env vars:
    DATABASE_URL
    ADMIN_PIN          (default: 1234 — change this!)
    BUSINESS_NAME      (optional)
"""

import os
import sys
import argparse
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from dotenv import load_dotenv
load_dotenv(os.path.join(ROOT, ".env"))

import psycopg2
import psycopg2.extras
from flask import Flask, request, jsonify, render_template_string, redirect, url_for, session

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", os.urandom(24).hex())

ADMIN_PIN = os.getenv("ADMIN_PIN", "1234")
BUSINESS = os.getenv("BUSINESS_NAME", "Your Business")
TZ_NAME = os.getenv("SCHEDULER_TIMEZONE", "America/Los_Angeles")


def get_db():
    return psycopg2.connect(os.getenv("DATABASE_URL"), cursor_factory=psycopg2.extras.RealDictCursor)


def local_now():
    return datetime.now(ZoneInfo(TZ_NAME))


def fmt_duration(clock_in_utc):
    if not clock_in_utc:
        return ""
    now = datetime.now(timezone.utc)
    if clock_in_utc.tzinfo is None:
        clock_in_utc = clock_in_utc.replace(tzinfo=timezone.utc)
    delta = now - clock_in_utc
    h, rem = divmod(int(delta.total_seconds()), 3600)
    m = rem // 60
    return f"{h}h {m:02d}m"


# ── HTML Templates ────────────────────────────────────────────────────────────

CLOCK_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{ business }} — Time Clock</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0f0f1a; color: #e2e2e8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; min-height: 100vh; }
  .header { text-align: center; padding: 24px 16px 8px; }
  .header h1 { font-size: 1.1em; font-weight: 500; color: #888; letter-spacing: 0.05em; text-transform: uppercase; }
  #clock { font-size: 3em; font-weight: 700; text-align: center; padding: 8px 0 28px; letter-spacing: -1px; }
  .container { max-width: 600px; margin: 0 auto; padding: 0 16px 40px; }
  .card { background: #1c1c2e; border-radius: 14px; padding: 18px 20px; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .info .name { font-size: 1.15em; font-weight: 600; }
  .info .status { font-size: 0.82em; margin-top: 5px; color: #666; }
  .info .status.active { color: #4ade80; }
  .btn { padding: 13px 22px; border: none; border-radius: 10px; font-size: 0.95em; font-weight: 700; cursor: pointer; white-space: nowrap; transition: opacity 0.15s; }
  .btn:active { opacity: 0.75; }
  .btn-in  { background: #4ade80; color: #0a0a14; }
  .btn-out { background: #f87171; color: #fff; }
  .btn:disabled { opacity: 0.4; cursor: default; }
  .footer { text-align: center; padding: 20px 0 10px; }
  .footer a { color: #444; font-size: 0.82em; text-decoration: none; }
  .footer a:hover { color: #888; }
  .toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: #333; color: #fff; padding: 12px 24px; border-radius: 8px; font-size: 0.9em; display: none; z-index: 100; }
  .toast.show { display: block; }
</style>
</head>
<body>
<div class="header"><h1>{{ business }}</h1></div>
<div id="clock"></div>
<div class="container">
  {% for t in techs %}
  <div class="card" id="card-{{ t.id }}">
    <div class="info">
      <div class="name">{{ t.first_name }} {{ t.last_name }}</div>
      {% if t.entry_id %}
        <div class="status active" id="status-{{ t.id }}">Clocked in {{ t.duration }}</div>
      {% else %}
        <div class="status" id="status-{{ t.id }}">Not clocked in</div>
      {% endif %}
    </div>
    {% if t.entry_id %}
      <button class="btn btn-out" onclick="doAction({{ t.id }}, 'clock-out')">Clock Out</button>
    {% else %}
      <button class="btn btn-in" onclick="doAction({{ t.id }}, 'clock-in')">Clock In</button>
    {% endif %}
  </div>
  {% endfor %}
</div>
<div class="footer"><a href="/admin">Admin</a></div>
<div class="toast" id="toast"></div>

<script>
function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent =
    now.toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
}
setInterval(updateClock, 1000);
updateClock();

function showToast(msg, color) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = color || '#333';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function doAction(techId, action) {
  const btn = document.querySelector(`#card-${techId} button`);
  btn.disabled = true;
  fetch(`/api/${action}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({tech_id: techId})
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      showToast(d.message, action === 'clock-in' ? '#16a34a' : '#b91c1c');
      setTimeout(() => location.reload(), 800);
    } else {
      showToast(d.error, '#b91c1c');
      btn.disabled = false;
    }
  })
  .catch(() => { showToast('Network error', '#b91c1c'); btn.disabled = false; });
}
</script>
</body>
</html>
"""

ADMIN_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin — Time Clock</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0f0f1a; color: #e2e2e8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px 16px 60px; }
  h1 { font-size: 1.3em; font-weight: 600; margin-bottom: 4px; }
  .sub { color: #666; font-size: 0.85em; margin-bottom: 24px; }
  .section { background: #1c1c2e; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
  .section h2 { font-size: 1em; font-weight: 600; color: #aaa; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.05em; }
  .form-row { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; align-items: flex-end; }
  label { font-size: 0.82em; color: #888; display: block; margin-bottom: 4px; }
  input, select, textarea { background: #0f0f1a; border: 1px solid #333; border-radius: 8px; color: #e2e2e8; padding: 9px 12px; font-size: 0.9em; width: 100%; }
  .field { flex: 1; min-width: 150px; }
  .field-sm { flex: 0 0 90px; }
  .field-lg { flex: 2; min-width: 200px; }
  .btn { padding: 10px 18px; border: none; border-radius: 8px; font-size: 0.88em; font-weight: 600; cursor: pointer; }
  .btn-primary { background: #6366f1; color: #fff; }
  .btn-danger { background: #ef4444; color: #fff; }
  .btn-sm { padding: 6px 12px; font-size: 0.8em; }
  table { width: 100%; border-collapse: collapse; font-size: 0.85em; }
  th { color: #666; font-weight: 500; text-align: left; padding: 8px 10px; border-bottom: 1px solid #2a2a3e; }
  td { padding: 10px 10px; border-bottom: 1px solid #1a1a2e; vertical-align: middle; }
  .edited { font-size: 0.75em; color: #6366f1; }
  .pin-gate { max-width: 320px; margin: 80px auto; text-align: center; }
  .pin-gate h2 { margin-bottom: 20px; }
  .pin-gate input { text-align: center; font-size: 1.5em; letter-spacing: 6px; margin-bottom: 14px; }
  .week-nav { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  .week-nav a { color: #6366f1; text-decoration: none; font-size: 0.9em; }
  .back { display: inline-block; margin-bottom: 20px; color: #6366f1; text-decoration: none; font-size: 0.88em; }
  .total-row td { font-weight: 600; border-top: 2px solid #333; }
  .flash { background: #16a34a22; border: 1px solid #4ade80; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; color: #4ade80; font-size: 0.88em; }
  .flash.error { background: #b91c1c22; border-color: #f87171; color: #f87171; }
</style>
</head>
<body>

{% if not authed %}
<div class="pin-gate">
  <h2>Admin Access</h2>
  <form method="POST" action="/admin/auth">
    <label>Enter PIN</label>
    <input type="password" name="pin" inputmode="numeric" maxlength="8" autofocus>
    <br>
    <button class="btn btn-primary" type="submit" style="width:100%;padding:13px">Enter</button>
    {% if error %}<p style="color:#f87171;margin-top:12px;font-size:0.85em">{{ error }}</p>{% endif %}
  </form>
</div>

{% else %}

<a class="back" href="/">← Back to Clock</a>
<h1>Admin — Time Clock</h1>
<p class="sub">{{ business }}</p>

{% if flash %}<div class="flash">{{ flash }}</div>{% endif %}
{% if flash_err %}<div class="flash error">{{ flash_err }}</div>{% endif %}

<!-- Add Manual Entry -->
<div class="section">
  <h2>Add / Manual Entry</h2>
  <form method="POST" action="/admin/add">
    <div class="form-row">
      <div class="field">
        <label>Technician</label>
        <select name="tech_id">
          {% for t in techs %}<option value="{{ t.id }}">{{ t.first_name }} {{ t.last_name }}</option>{% endfor %}
        </select>
      </div>
      <div class="field">
        <label>Clock In</label>
        <input type="datetime-local" name="clock_in" required>
      </div>
      <div class="field">
        <label>Clock Out (optional)</label>
        <input type="datetime-local" name="clock_out">
      </div>
      <div class="field-sm">
        <label>Break (min)</label>
        <input type="number" name="break_minutes" value="0" min="0">
      </div>
      <div class="field">
        <label>Notes</label>
        <input type="text" name="notes" placeholder="optional">
      </div>
    </div>
    <button class="btn btn-primary" type="submit">Add Entry</button>
  </form>
</div>

<!-- Weekly Timesheet -->
<div class="section">
  <h2>Timesheet</h2>
  <div class="week-nav">
    <a href="/admin?week={{ prev_week }}">← Prev Week</a>
    <span style="font-weight:600">{{ week_label }}</span>
    <a href="/admin?week={{ next_week }}">Next Week →</a>
  </div>
  {% if entries %}
  <table>
    <thead>
      <tr>
        <th>Name</th><th>Date</th><th>Clock In</th><th>Clock Out</th><th>Break</th><th>Hours</th><th>Notes</th><th></th>
      </tr>
    </thead>
    <tbody>
      {% for e in entries %}
      <tr id="row-{{ e.id }}">
        <td>{{ e.first_name }} {{ e.last_name }}</td>
        <td>{{ e.clock_in.strftime('%a %m/%d') }}</td>
        <td>{{ e.clock_in.strftime('%I:%M %p') }}</td>
        <td>{% if e.clock_out %}{{ e.clock_out.strftime('%I:%M %p') }}{% else %}<em style="color:#666">active</em>{% endif %}</td>
        <td>{{ e.break_minutes }}m</td>
        <td>{% if e.hours_worked %}{{ '%.2f'|format(e.hours_worked|float) }}{% else %}—{% endif %}</td>
        <td>
          {{ e.notes or '' }}
          {% if e.edited_by %}<br><span class="edited">edited by {{ e.edited_by }}</span>{% endif %}
        </td>
        <td><button class="btn btn-primary btn-sm" onclick="openEdit({{ e.id }}, '{{ e.tech_id }}', '{{ e.clock_in_iso }}', '{{ e.clock_out_iso }}', {{ e.break_minutes }}, '{{ e.notes or '' }}')">Edit</button></td>
      </tr>
      {% endfor %}
      {% if total_hours %}
      <tr class="total-row">
        <td colspan="5">Total</td>
        <td>{{ '%.2f'|format(total_hours) }} hrs</td>
        <td colspan="2"></td>
      </tr>
      {% endif %}
    </tbody>
  </table>
  {% else %}
  <p style="color:#555;font-size:0.9em">No entries for this week.</p>
  {% endif %}
</div>

<!-- Edit Modal -->
<div id="modal" style="display:none;position:fixed;inset:0;background:#000a;z-index:200;display:none;align-items:center;justify-content:center;">
  <div style="background:#1c1c2e;border-radius:14px;padding:24px;width:90%;max-width:480px;">
    <h2 style="margin-bottom:16px;font-size:1em;">Edit Entry</h2>
    <form method="POST" action="/admin/edit">
      <input type="hidden" name="entry_id" id="edit_id">
      <div class="form-row">
        <div class="field">
          <label>Clock In</label>
          <input type="datetime-local" name="clock_in" id="edit_clock_in" required>
        </div>
        <div class="field">
          <label>Clock Out</label>
          <input type="datetime-local" name="clock_out" id="edit_clock_out">
        </div>
      </div>
      <div class="form-row">
        <div class="field-sm">
          <label>Break (min)</label>
          <input type="number" name="break_minutes" id="edit_break" min="0">
        </div>
        <div class="field-lg">
          <label>Notes</label>
          <input type="text" name="notes" id="edit_notes">
        </div>
      </div>
      <div style="margin-top:4px;margin-bottom:16px;">
        <label>Your name (admin)</label>
        <input type="text" name="admin_name" placeholder="e.g. Cyrus">
      </div>
      <div style="display:flex;gap:10px;">
        <button class="btn btn-primary" type="submit">Save Changes</button>
        <button class="btn" type="button" onclick="closeEdit()" style="background:#333;">Cancel</button>
      </div>
    </form>
  </div>
</div>

<script>
function openEdit(id, techId, clockIn, clockOut, brk, notes) {
  document.getElementById('edit_id').value = id;
  document.getElementById('edit_clock_in').value = clockIn;
  document.getElementById('edit_clock_out').value = clockOut;
  document.getElementById('edit_break').value = brk;
  document.getElementById('edit_notes').value = notes;
  document.getElementById('modal').style.display = 'flex';
}
function closeEdit() { document.getElementById('modal').style.display = 'none'; }
</script>

{% endif %}
</body>
</html>
"""


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_techs_with_status():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id, first_name, last_name FROM technicians ORDER BY first_name")
    techs = list(cur.fetchall())

    cur.execute("""
        SELECT DISTINCT ON (technician_id)
            id AS entry_id, technician_id, clock_in
        FROM time_entries
        WHERE clock_out IS NULL
        ORDER BY technician_id, clock_in DESC
    """)
    active = {r["technician_id"]: r for r in cur.fetchall()}
    cur.close()
    conn.close()

    result = []
    for t in techs:
        a = active.get(t["id"])
        result.append({
            "id": t["id"],
            "first_name": t["first_name"],
            "last_name": t["last_name"],
            "entry_id": a["entry_id"] if a else None,
            "duration": fmt_duration(a["clock_in"]) if a else "",
        })
    return result


def calc_hours(clock_in, clock_out, break_minutes):
    if not clock_out:
        return None
    ci = clock_in if clock_in.tzinfo else clock_in.replace(tzinfo=timezone.utc)
    co = clock_out if clock_out.tzinfo else clock_out.replace(tzinfo=timezone.utc)
    total_secs = (co - ci).total_seconds() - (break_minutes * 60)
    return round(max(total_secs, 0) / 3600, 2)


def week_bounds(week_str=None):
    if week_str:
        try:
            ref = datetime.strptime(week_str, "%Y-%m-%d").date()
        except ValueError:
            ref = local_now().date()
    else:
        ref = local_now().date()
    monday = ref - timedelta(days=ref.weekday())
    sunday = monday + timedelta(days=6)
    return monday, sunday


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    techs = get_techs_with_status()
    return render_template_string(CLOCK_PAGE, business=BUSINESS, techs=techs)


@app.route("/api/clock-in", methods=["POST"])
def api_clock_in():
    data = request.get_json()
    tech_id = data.get("tech_id")
    if not tech_id:
        return jsonify({"success": False, "error": "Missing tech_id"})

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id FROM time_entries WHERE technician_id = %s AND clock_out IS NULL", (tech_id,))
    if cur.fetchone():
        cur.close(); conn.close()
        return jsonify({"success": False, "error": "Already clocked in"})

    cur.execute(
        "INSERT INTO time_entries (technician_id, clock_in) VALUES (%s, NOW()) RETURNING id",
        (tech_id,)
    )
    conn.commit(); cur.close(); conn.close()
    return jsonify({"success": True, "message": "Clocked in"})


@app.route("/api/clock-out", methods=["POST"])
def api_clock_out():
    data = request.get_json()
    tech_id = data.get("tech_id")
    if not tech_id:
        return jsonify({"success": False, "error": "Missing tech_id"})

    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, clock_in, break_minutes FROM time_entries WHERE technician_id = %s AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1",
        (tech_id,)
    )
    row = cur.fetchone()
    if not row:
        cur.close(); conn.close()
        return jsonify({"success": False, "error": "Not clocked in"})

    entry_id = row["id"]
    clock_in = row["clock_in"]
    brk = row["break_minutes"] or 0
    now = datetime.now(timezone.utc)
    hours = calc_hours(clock_in, now, brk)

    cur.execute(
        "UPDATE time_entries SET clock_out = %s, hours_worked = %s WHERE id = %s",
        (now, hours, entry_id)
    )
    conn.commit(); cur.close(); conn.close()
    return jsonify({"success": True, "message": f"Clocked out — {hours:.2f}h"})


@app.route("/admin", methods=["GET"])
def admin():
    authed = session.get("admin_authed", False)
    if not authed:
        return render_template_string(ADMIN_PAGE, authed=False, error=None, business=BUSINESS)

    week_str = request.args.get("week")
    monday, sunday = week_bounds(week_str)
    prev_week = (monday - timedelta(days=7)).isoformat()
    next_week = (monday + timedelta(days=7)).isoformat()
    week_label = f"{monday.strftime('%b %d')} – {sunday.strftime('%b %d, %Y')}"

    conn = get_db()
    cur = conn.cursor()

    # Get technicians for the add form
    cur.execute("SELECT id, first_name, last_name FROM technicians ORDER BY first_name")
    techs = list(cur.fetchall())

    # Get entries for the week
    cur.execute("""
        SELECT
            te.id,
            te.technician_id AS tech_id,
            t.first_name,
            t.last_name,
            te.clock_in,
            te.clock_out,
            te.break_minutes,
            te.hours_worked,
            te.notes,
            te.edited_by
        FROM time_entries te
        JOIN technicians t ON t.id = te.technician_id
        WHERE te.clock_in::date BETWEEN %s AND %s
        ORDER BY te.clock_in DESC
    """, (monday, sunday))
    rows = list(cur.fetchall())
    cur.close(); conn.close()

    tz = ZoneInfo(TZ_NAME)
    entries = []
    total_hours = 0.0
    for r in rows:
        ci = r["clock_in"].astimezone(tz) if r["clock_in"] else None
        co = r["clock_out"].astimezone(tz) if r["clock_out"] else None
        entries.append({
            **r,
            "clock_in": ci,
            "clock_out": co,
            "clock_in_iso": ci.strftime("%Y-%m-%dT%H:%M") if ci else "",
            "clock_out_iso": co.strftime("%Y-%m-%dT%H:%M") if co else "",
        })
        if r["hours_worked"]:
            total_hours += float(r["hours_worked"])

    flash = session.pop("flash", None)
    flash_err = session.pop("flash_err", None)

    return render_template_string(ADMIN_PAGE,
        authed=True, business=BUSINESS, techs=techs, entries=entries,
        total_hours=total_hours, week_label=week_label,
        prev_week=prev_week, next_week=next_week,
        flash=flash, flash_err=flash_err, error=None)


@app.route("/admin/auth", methods=["POST"])
def admin_auth():
    if request.form.get("pin") == ADMIN_PIN:
        session["admin_authed"] = True
        return redirect(url_for("admin"))
    return render_template_string(ADMIN_PAGE, authed=False, error="Incorrect PIN", business=BUSINESS)


@app.route("/admin/edit", methods=["POST"])
def admin_edit():
    if not session.get("admin_authed"):
        return redirect(url_for("admin"))

    entry_id = request.form.get("entry_id")
    clock_in_str = request.form.get("clock_in")
    clock_out_str = request.form.get("clock_out")
    break_minutes = int(request.form.get("break_minutes", 0))
    notes = request.form.get("notes", "")
    admin_name = request.form.get("admin_name", "admin")

    tz = ZoneInfo(TZ_NAME)
    try:
        clock_in = datetime.fromisoformat(clock_in_str).replace(tzinfo=tz)
        clock_out = datetime.fromisoformat(clock_out_str).replace(tzinfo=tz) if clock_out_str else None
        hours = calc_hours(clock_in, clock_out, break_minutes)

        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            UPDATE time_entries
            SET clock_in = %s, clock_out = %s, break_minutes = %s,
                hours_worked = %s, notes = %s, edited_by = %s, edited_at = NOW()
            WHERE id = %s
        """, (clock_in, clock_out, break_minutes, hours, notes, admin_name, entry_id))
        conn.commit(); cur.close(); conn.close()
        session["flash"] = f"Entry #{entry_id} updated by {admin_name}."
    except Exception as e:
        session["flash_err"] = f"Error updating entry: {e}"

    return redirect(url_for("admin"))


@app.route("/admin/add", methods=["POST"])
def admin_add():
    if not session.get("admin_authed"):
        return redirect(url_for("admin"))

    tech_id = request.form.get("tech_id")
    clock_in_str = request.form.get("clock_in")
    clock_out_str = request.form.get("clock_out")
    break_minutes = int(request.form.get("break_minutes", 0))
    notes = request.form.get("notes", "")

    tz = ZoneInfo(TZ_NAME)
    try:
        clock_in = datetime.fromisoformat(clock_in_str).replace(tzinfo=tz)
        clock_out = datetime.fromisoformat(clock_out_str).replace(tzinfo=tz) if clock_out_str else None
        hours = calc_hours(clock_in, clock_out, break_minutes)

        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO time_entries (technician_id, clock_in, clock_out, break_minutes, hours_worked, notes)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (tech_id, clock_in, clock_out, break_minutes, hours, notes))
        conn.commit(); cur.close(); conn.close()
        session["flash"] = "Manual entry added."
    except Exception as e:
        session["flash_err"] = f"Error adding entry: {e}"

    return redirect(url_for("admin"))


# ── Entry Point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Time clock web server.")
    parser.add_argument("--host", default="0.0.0.0", help="Host (default: 0.0.0.0 for LAN access)")
    parser.add_argument("--port", type=int, default=5000)
    parser.add_argument("--debug", action="store_true")
    args = parser.parse_args()

    print(f"\n  {BUSINESS} — Time Clock")
    print(f"  Running at http://{args.host}:{args.port}")
    print(f"  Admin PIN: {ADMIN_PIN}\n")
    app.run(host=args.host, port=args.port, debug=args.debug)


if __name__ == "__main__":
    main()
