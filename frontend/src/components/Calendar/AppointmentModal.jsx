import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { SERVICES } from '../../data/mockData'

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

/* ── Client search autocomplete ─────────────────────────────── */
function ClientSearch({ clients, onSelect }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)

  const results = q.length >= 2
    ? clients.filter(c => {
        const name  = `${c.firstName} ${c.lastName}`.toLowerCase()
        const phone = (c.phone || '').replace(/\D/g, '')
        return name.includes(q.toLowerCase()) || phone.includes(q.replace(/\D/g, ''))
      }).slice(0, 6)
    : []

  return (
    <div className="form-group" style={{ position: 'relative', marginBottom: 8 }}>
      <label className="form-label">Search Existing Client</label>
      <input
        className="form-input"
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true) }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Type name or phone…"
      />
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.13)', overflow: 'hidden',
        }}>
          {results.map(c => (
            <div
              key={c.id}
              onMouseDown={() => { onSelect(c); setQ(`${c.firstName} ${c.lastName}`); setOpen(false) }}
              style={{
                padding: '9px 14px', cursor: 'pointer', fontSize: 13,
                borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 10, alignItems: 'center',
              }}
            >
              <span style={{ fontWeight: 600, color: '#1e293b' }}>{c.firstName} {c.lastName}</span>
              {c.phone && <span style={{ color: '#94a3b8', fontSize: 12 }}>{c.phone}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Multi-service builder ───────────────────────────────────── */
function ServiceBuilder({ services, onChange }) {
  const [adding, setAdding] = useState(false)
  const usedNames = new Set(services.map(s => s.name))
  const available = SERVICES.filter(s => !usedNames.has(s.name))

  function addService(name) {
    const svc = SERVICES.find(s => s.name === name)
    if (svc) onChange([...services, { name: svc.name, duration: svc.duration }])
    setAdding(false)
  }

  function remove(i) {
    if (services.length > 1) onChange(services.filter((_, idx) => idx !== i))
  }

  return (
    <div className="form-group">
      <label className="form-label">Services *</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {services.map((s, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#f8fafc', border: '1px solid #e2e8f0',
            borderRadius: 8, padding: '7px 10px',
          }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{s.name}</span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{s.duration}m</span>
            {services.length > 1 && (
              <button type="button" onClick={() => remove(i)}
                style={{ background:'none', border:'none', cursor:'pointer', color:'#cbd5e1', fontSize:18, lineHeight:1, padding:0 }}>
                ×
              </button>
            )}
          </div>
        ))}
        {adding ? (
          <select className="form-select" autoFocus defaultValue=""
            onChange={e => e.target.value && addService(e.target.value)}
            onBlur={() => setAdding(false)}>
            <option value="">Pick a service…</option>
            {available.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
        ) : available.length > 0 && (
          <button type="button" onClick={() => setAdding(true)}
            style={{
              background: 'none', border: '1.5px dashed #cbd5e1', borderRadius: 8,
              padding: '7px 10px', cursor: 'pointer', fontSize: 12, color: '#94a3b8',
              textAlign: 'left', fontFamily: 'inherit',
            }}>
            + Add another service
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Booking form (new + edit) ──────────────────────────────── */
function BookingForm({ initial, technicians, clients, onSave, onCancel }) {
  const initServices = initial.services?.length
    ? initial.services
    : initial.service
      ? [{ name: initial.service, duration: initial.duration || 60 }]
      : [{ name: SERVICES[0].name, duration: SERVICES[0].duration }]

  const [form,     setForm]     = useState({ ...initial, techRequested: initial.techRequested || false })
  const [services, setServices] = useState(initServices)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const totalDuration = services.reduce((sum, s) => sum + s.duration, 0)
  const tech    = technicians.find(t => t.id === form.technicianId)
  const endTime = addMinutes(form.startTime, totalDuration)

  function handleSave() {
    if (!form.clientName.trim() || !form.clientPhone?.trim() || !services.length) return
    onSave({
      ...form,
      service:  services.map(s => s.name).join(' + '),
      services,
      duration: totalDuration,
    })
  }

  const canSave = form.clientName.trim() && form.clientPhone?.trim() && services.length > 0

  return (
    <div className="modal-body">
      <ClientSearch clients={clients} onSelect={c => {
        set('clientName',  `${c.firstName} ${c.lastName}`)
        set('clientPhone', c.phone || '')
      }} />

      <div style={{ display:'flex', gap:10 }}>
        <div className="form-group" style={{ flex:2 }}>
          <label className="form-label">Client Name *</label>
          <input className="form-input" value={form.clientName}
            onChange={e => set('clientName', e.target.value)} placeholder="Enter client name" />
        </div>
        <div className="form-group" style={{ flex:1 }}>
          <label className="form-label">Phone *</label>
          <input className="form-input" type="tel" value={form.clientPhone || ''}
            onChange={e => set('clientPhone', formatPhone(e.target.value))} placeholder="(616) 555-0100" />
        </div>
      </div>

      <ServiceBuilder services={services} onChange={setServices} />

      <div className="form-group">
        <label className="form-label">Technician</label>
        <select className="form-select" value={form.technicianId}
          onChange={e => set('technicianId', Number(e.target.value))}>
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
      </div>
      <div style={{ fontSize:12, color:'#64748b', marginBottom:12 }}>
        {formatTime(form.startTime)} → {formatTime(endTime)} · {totalDuration} min · {tech?.name}
      </div>

      <div className="form-group">
        <label className="form-label">Notes</label>
        <textarea className="form-textarea" value={form.notes}
          onChange={e => set('notes', e.target.value)} placeholder="Optional notes…" />
      </div>

      <label style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, cursor:'pointer' }}>
        <input type="checkbox" checked={form.techRequested}
          onChange={e => set('techRequested', e.target.checked)}
          style={{ width:15, height:15, accentColor:'#ef4444' }} />
        <span style={{ fontSize:13, fontWeight:600, color:'#ef4444' }}>Tech Requested</span>
      </label>

      <div className="modal-footer" style={{ padding:0, border:'none' }}>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={!canSave}>Save</button>
      </div>
    </div>
  )
}

/* ── View existing appointment ──────────────────────────────── */
function ViewModal({ appointment, tech, canEdit, onClose, onEdit, onDelete, onReschedule, onCashOut, onCheckIn, onToggleRequested, onConfirm }) {
  const [rescheduling, setRescheduling] = useState(false)
  const [reschedDate,  setReschedDate]  = useState(appointment.date)
  const [reschedTime,  setReschedTime]  = useState(appointment.startTime)

  const end = addMinutes(appointment.startTime, appointment.duration)
  const serviceDisplay = appointment.services?.length
    ? appointment.services.map(s => s.name).join(' + ')
    : appointment.service

  return (
    <>
      <div className="modal-header">
        <div className="modal-header-dot" style={{
          background: appointment.status === 'checkedin' ? '#10b981'
            : appointment.techRequested ? '#ef4444'
            : tech?.color
        }} />
        <div className="modal-title">{appointment.clientName}</div>
        <div style={{ display:'flex', gap:5, marginLeft:'auto', marginRight:8, alignItems:'center' }}>
          {appointment.techRequested && (
            <span style={{ fontSize:10, fontWeight:800, letterSpacing:'0.06em', padding:'2px 8px', borderRadius:12, background:'rgba(239,68,68,0.12)', color:'#ef4444', whiteSpace:'nowrap' }}>
              ★ REQUESTED
            </span>
          )}
          {appointment.clientConfirmed && appointment.status !== 'checkedin' && (
            <span style={{ fontSize:10, fontWeight:800, letterSpacing:'0.06em', padding:'2px 8px', borderRadius:12, background:'rgba(30,64,175,0.12)', color:'#1d4ed8', whiteSpace:'nowrap' }}>
              ✓ CONFIRMED
            </span>
          )}
          {appointment.status === 'checkedin' && (
            <span style={{ fontSize:10, fontWeight:800, letterSpacing:'0.06em', padding:'2px 8px', borderRadius:12, background:'rgba(16,185,129,0.15)', color:'#10b981', whiteSpace:'nowrap' }}>
              ● CHECKED IN
            </span>
          )}
        </div>
        <button className="modal-close" onClick={onClose}>×</button>
      </div>

      <div className="modal-body">
        {[
          ['Service',    serviceDisplay],
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

      {rescheduling && (
        <div style={{ padding:'14px 20px', borderTop:'2px solid #e0e7ff', background:'#f5f7ff' }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#4f46e5', marginBottom:12 }}>📅 Reschedule Appointment</div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>
            <div className="form-group" style={{ margin:0, flex:1, minWidth:130 }}>
              <label className="form-label">New Date</label>
              <input className="form-input" type="date" value={reschedDate} onChange={e => setReschedDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin:0, flex:1, minWidth:120 }}>
              <label className="form-label">New Time</label>
              <input className="form-input" type="time" value={reschedTime} onChange={e => setReschedTime(e.target.value)} />
            </div>
            <button className="btn btn-ghost" style={{ flexShrink:0 }} onClick={() => setRescheduling(false)}>Cancel</button>
            <button className="btn btn-primary" style={{ flexShrink:0 }}
              onClick={() => reschedDate && reschedTime && onReschedule({ date: reschedDate, startTime: reschedTime })}>
              Save
            </button>
          </div>
          {reschedDate && reschedTime && (
            <div style={{ marginTop:8, fontSize:12, color:'#6366f1' }}>
              Moving to {reschedDate} at {formatTime(reschedTime)}
            </div>
          )}
        </div>
      )}

      <div className="modal-footer" style={{ flexDirection:'column', gap:8 }}>
        {/* Row 1 — status actions */}
        {canEdit && (
          <div style={{ display:'flex', gap:8, width:'100%', flexWrap:'wrap' }}>
            <button className="btn btn-ghost" style={{ flex:1, minWidth:90,
              color: appointment.techRequested ? '#ef4444' : '#94a3b8',
              borderColor: appointment.techRequested ? '#fca5a5' : '#e2e8f0' }}
              onClick={onToggleRequested}>
              {appointment.techRequested ? '★ Requested' : '☆ Request'}
            </button>
            {appointment.status !== 'checkedin' && !appointment.clientConfirmed && (
              <button className="btn btn-ghost" style={{ flex:1, minWidth:90, color:'#1d4ed8', borderColor:'#bfdbfe' }}
                onClick={onConfirm}>
                ✓ Confirm
              </button>
            )}
            {appointment.status !== 'checkedin' && onCheckIn && (
              <button className="btn btn-primary" style={{ flex:1, minWidth:90, background:'#10b981' }}
                onClick={onCheckIn}>
                ✓ Check In
              </button>
            )}
            {appointment.status === 'checkedin' && onCashOut && (
              <button className="btn btn-primary" style={{ flex:1, minWidth:90, background:'#10b981' }}
                onClick={() => onCashOut(appointment)}>
                Cash Out →
              </button>
            )}
          </div>
        )}
        {/* Row 2 — management actions */}
        <div style={{ display:'flex', gap:8, width:'100%', flexWrap:'wrap' }}>
          <button className="btn btn-danger" onClick={() => onDelete(appointment.id)}>Remove</button>
          {canEdit && !rescheduling && (
            <button className="btn btn-ghost" style={{ color:'#4f46e5', borderColor:'#c7d2fe' }}
              onClick={() => setRescheduling(true)}>Reschedule</button>
          )}
          {canEdit && <button className="btn btn-ghost" onClick={onEdit}>Edit</button>}
          <button className="btn btn-ghost" style={{ marginLeft:'auto' }} onClick={onClose}>Close</button>
        </div>
      </div>
    </>
  )
}

/* ── Wrapper ────────────────────────────────────────────────── */
export default function AppointmentModal({ appointment, newData, technicians, onClose, onSave, onDelete, onCashOut, onCheckIn }) {
  const { user, updateAppointment, clients } = useApp()
  const [editing, setEditing] = useState(false)
  const canEdit = user.role === 'admin' || user.role === 'receptionist'
  const tech = appointment ? technicians.find(t => t.id === appointment.technicianId) : null

  function handleUpdate(form) { updateAppointment(appointment.id, form); onClose() }
  function handleReschedule({ date, startTime }) { updateAppointment(appointment.id, { ...appointment, date, startTime }); onClose() }
  function handleToggleRequested() { updateAppointment(appointment.id, { ...appointment, techRequested: !appointment.techRequested }); onClose() }
  function handleConfirm() { updateAppointment(appointment.id, { ...appointment, clientConfirmed: true }); onClose() }

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
              initial={{ clientName:'', clientPhone:'', service: SERVICES[0].name, services: null, technicianId: newData.technicianId, date: newData.date, startTime: newData.time, duration: SERVICES[0].duration, notes:'', techRequested: false, clientConfirmed: false }}
              technicians={technicians}
              clients={clients}
              onSave={form => { onSave(form) }}
              onCancel={onClose}
            />
          </>
        )}

        {/* View existing */}
        {appointment && !editing && (
          <ViewModal
            appointment={appointment}
            tech={tech}
            canEdit={canEdit}
            onClose={onClose}
            onEdit={() => setEditing(true)}
            onDelete={onDelete}
            onReschedule={handleReschedule}
            onCashOut={onCashOut}
            onCheckIn={onCheckIn ? () => onCheckIn(appointment.id) : undefined}
            onToggleRequested={handleToggleRequested}
            onConfirm={handleConfirm}
          />
        )}

        {/* Edit existing */}
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
              clients={clients}
              onSave={handleUpdate}
              onCancel={() => setEditing(false)}
            />
          </>
        )}
      </div>
    </div>
  )
}
