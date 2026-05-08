import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { SERVICES } from '../../data/mockData'

const DURATIONS = [15, 30, 45, 60, 75, 90, 120]

function formatPhone(raw) {
  const d = raw.replace(/\D/g, '').slice(0, 10)
  if (d.length < 4) return d
  if (d.length < 7) return `(${d.slice(0,3)}) ${d.slice(3)}`
  return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`
}

function formatTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function addMinutes(t, mins) {
  const [h, m] = t.split(':').map(Number)
  const total = h * 60 + m + mins
  return `${String(Math.floor(total / 60)).padStart(2,'0')}:${String(total % 60).padStart(2,'0')}`
}

/* ── Shared booking form (new + edit) ─────────────────────── */
function BookingForm({ initial, technicians, dateLabel, onSave, onCancel }) {
  const [form, setForm] = useState(initial)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const tech = technicians.find(t => t.id === form.technicianId)
  const endTime = addMinutes(form.startTime, Number(form.duration))

  return (
    <div className="modal-body">
      <div style={{ display:'flex', gap:10 }}>
        <div className="form-group" style={{ flex:2 }}>
          <label className="form-label">Client Name *</label>
          <input className="form-input" value={form.clientName} onChange={e => set('clientName', e.target.value)} placeholder="Enter client name" autoFocus />
        </div>
        <div className="form-group" style={{ flex:1 }}>
          <label className="form-label">Phone *</label>
          <input className="form-input" type="tel" value={form.clientPhone || ''} onChange={e => set('clientPhone', formatPhone(e.target.value))} placeholder="(616) 555-0100" />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Service *</label>
        <select className="form-select" value={form.service} onChange={e => {
          const svc = SERVICES.find(s => s.name === e.target.value)
          setForm(f => ({ ...f, service: e.target.value, duration: svc?.duration ?? f.duration }))
        }}>
          {!SERVICES.some(s => s.name === form.service) && form.service && (
            <option value={form.service}>{form.service}</option>
          )}
          {SERVICES.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Technician</label>
        <select className="form-select" value={form.technicianId} onChange={e => set('technicianId', Number(e.target.value))}>
          {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div style={{ display:'flex', gap:10 }}>
        <div className="form-group" style={{ flex:1 }}>
          <label className="form-label">Date</label>
          <input className="form-input" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
        </div>
        <div className="form-group" style={{ flex:1 }}>
          <label className="form-label">Start Time</label>
          <input className="form-input" type="time" value={form.startTime} onChange={e => set('startTime', e.target.value)} />
        </div>
        <div className="form-group" style={{ flex:1 }}>
          <label className="form-label">Duration</label>
          <select className="form-select" value={form.duration} onChange={e => set('duration', Number(e.target.value))}>
            {DURATIONS.map(d => <option key={d} value={d}>{d} min</option>)}
          </select>
        </div>
      </div>
      <div style={{ fontSize:12, color:'#64748b' }}>
        {formatTime(form.startTime)} → {formatTime(endTime)} · {tech?.name}
      </div>
      <div className="form-group">
        <label className="form-label">Notes</label>
        <textarea className="form-textarea" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional notes..." />
      </div>
      <div className="modal-footer" style={{ padding:0, border:'none' }}>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={() => form.clientName.trim() && form.clientPhone?.trim() && form.service && onSave(form)}>Save</button>
      </div>
    </div>
  )
}

/* ── View existing appointment ─────────────────────────────── */
function ViewModal({ appointment, tech, canEdit, onClose, onEdit, onDelete }) {
  const end = addMinutes(appointment.startTime, appointment.duration)
  return (
    <>
      <div className="modal-header">
        <div className="modal-header-dot" style={{ background: tech?.color }} />
        <div className="modal-title">{appointment.clientName}</div>
        <button className="modal-close" onClick={onClose}>×</button>
      </div>
      <div className="modal-body">
        {[
          ['Service',    appointment.service],
          ['Technician', tech?.name],
          ['Date',       appointment.date],
          ['Time',       `${formatTime(appointment.startTime)} – ${formatTime(end)}`],
          ['Duration',   `${appointment.duration} min`],
        ].map(([label, val]) => (
          <div key={label} className="modal-detail-row">
            <span className="modal-detail-label">{label}</span>
            <span className="modal-detail-value">{val}</span>
          </div>
        ))}
        {appointment.clientPhone && (
          <div className="modal-detail-row">
            <span className="modal-detail-label">Phone</span>
            <a href={`tel:${appointment.clientPhone}`} className="modal-detail-value"
               style={{ color:'#818cf8', textDecoration:'none' }}>
              {appointment.clientPhone}
            </a>
          </div>
        )}
        {appointment.notes && (
          <div className="modal-detail-row">
            <span className="modal-detail-label">Notes</span>
            <div className="modal-notes">{appointment.notes}</div>
          </div>
        )}
      </div>
      <div className="modal-footer">
        <button className="btn btn-danger" onClick={() => onDelete(appointment.id)}>Remove</button>
        {canEdit && <button className="btn btn-ghost" onClick={onEdit}>Edit</button>}
        <button className="btn btn-ghost" onClick={onClose}>Close</button>
      </div>
    </>
  )
}

/* ── Wrapper ──────────────────────────────────────────────── */
export default function AppointmentModal({ appointment, newData, technicians, onClose, onSave, onDelete }) {
  const { user, updateAppointment } = useApp()
  const [editing, setEditing] = useState(false)
  const canEdit = user.role === 'admin' || user.role === 'receptionist'
  const tech = appointment ? technicians.find(t => t.id === appointment.technicianId) : null

  function handleUpdate(form) {
    updateAppointment(appointment.id, form)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        {/* New appointment */}
        {!appointment && (
          <>
            <div className="modal-header">
              <div className="modal-header-dot" style={{ background: technicians.find(t => t.id === newData.technicianId)?.color }} />
              <div className="modal-title">New Appointment</div>
              <button className="modal-close" onClick={onClose}>×</button>
            </div>
            <BookingForm
              initial={{ clientName:'', clientPhone:'', service: SERVICES[0].name, technicianId: newData.technicianId, date: newData.date, startTime: newData.time, duration: SERVICES[0].duration, notes:'' }}
              technicians={technicians}
              onSave={form => { onSave(form); }}
              onCancel={onClose}
            />
          </>
        )}

        {/* View / Edit existing */}
        {appointment && !editing && (
          <ViewModal
            appointment={appointment}
            tech={tech}
            canEdit={canEdit}
            onClose={onClose}
            onEdit={() => setEditing(true)}
            onDelete={onDelete}
          />
        )}

        {appointment && editing && (
          <>
            <div className="modal-header">
              <div className="modal-header-dot" style={{ background: tech?.color }} />
              <div className="modal-title">Edit Appointment</div>
              <button className="modal-close" onClick={onClose}>×</button>
            </div>
            <BookingForm
              initial={{ ...appointment }}
              technicians={technicians}
              onSave={handleUpdate}
              onCancel={() => setEditing(false)}
            />
          </>
        )}
      </div>
    </div>
  )
}
