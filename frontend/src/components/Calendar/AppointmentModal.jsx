import { useState, useMemo } from 'react'
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
  const { appointments } = useApp()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)

  // Normalize phone: strip leading country code so "16165550100" → "6165550100"
  function normPhone(p) {
    const d = (p || '').replace(/\D/g, '')
    return d.length === 11 && d.startsWith('1') ? d.slice(1) : d
  }

  // Merge real clients with unique entries derived from appointment history
  const allClients = useMemo(() => {
    const seenPhone = new Set(clients.map(c => normPhone(c.phone)).filter(d => d.length >= 10))
    const seenName  = new Set(clients.map(c => (c.name || '').toLowerCase().trim()).filter(Boolean))
    const fromApts  = []
    for (const apt of appointments) {
      const name   = (apt.clientName || '').trim()
      if (!name) continue
      const digits = normPhone(apt.clientPhone)
      // Dedup: by phone if available, else by name
      if (digits.length === 10) {
        if (seenPhone.has(digits)) continue
        seenPhone.add(digits)
      } else {
        const lname = name.toLowerCase()
        if (seenName.has(lname)) continue
        seenName.add(lname)
      }
      const parts = name.split(/\s+/)
      fromApts.push({
        id:        digits ? `apt-${digits}` : `apt-n-${name.replace(/\s+/g,'-')}`,
        firstName: parts[0] || '',
        lastName:  parts.slice(1).join(' '),
        name,
        phone:     digits.length === 10 ? (apt.clientPhone || '') : '',
      })
    }
    return [...clients, ...fromApts]
  }, [clients, appointments])

  const results = q.length >= 2
    ? allClients.filter(c => {
        const name   = `${c.name || ''} ${c.firstName || ''} ${c.lastName || ''}`.toLowerCase()
        const phone  = (c.phone || '').replace(/\D/g, '')
        const phoneQ = q.replace(/\D/g, '')
        return name.includes(q.toLowerCase()) || (phoneQ.length > 0 && phone.includes(phoneQ))
      }).slice(0, 8)
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

/* ── Multi-service builder with per-service tech ────────────── */
const TIME_SLOTS = (() => {
  const s = []
  for (let t = 8 * 60; t < 21 * 60; t += 15)
    s.push(`${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`)
  return s
})()

function ServiceBuilder({ services, onChange, technicians, timing, defaultTechId, aptStartTime }) {
  const [openPicker, setOpenPicker] = useState(null)
  const available = SERVICES

  function calcSeqTime(idx) {
    if (!aptStartTime) return ''
    const [h, m] = aptStartTime.split(':').map(Number)
    let mins = h * 60 + m
    for (let j = 0; j < idx; j++) mins += (services[j].duration || 0)
    if (mins >= 24 * 60) return ''
    return `${String(Math.floor(mins / 60)).padStart(2,'0')}:${String(mins % 60).padStart(2,'0')}`
  }

  function addService(name) {
    const svc = SERVICES.find(s => s.name === name)
    if (!svc) return
    const techId = defaultTechId || technicians[0]?.id || null
    onChange([...services, { name: svc.name, duration: svc.duration, technicianId: techId }])
  }

  function remove(i) {
    onChange(services.filter((_, idx) => idx !== i))
    setOpenPicker(null)
  }

  function updateTech(i, techId) {
    onChange(services.map((s, idx) => idx === i ? { ...s, technicianId: techId } : s))
  }

  function updateStartTime(i, time) {
    onChange(services.map((s, idx) => idx === i ? { ...s, startTime: time || undefined } : s))
  }

  function updateTechRequested(i, val) {
    onChange(services.map((s, idx) => idx === i ? { ...s, techRequested: val } : s))
  }

  return (
    <div className="form-group">
      <label className="form-label">Services *</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {services.map((s, i) => {
          const calcTime   = calcSeqTime(i)
          const pickerOpen = openPicker === i
          return (
          <div key={i} style={{
            background: '#f8fafc', border: '1px solid #e2e8f0',
            borderRadius: 8, padding: '8px 10px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{s.name}</span>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{s.duration}m</span>
              <button type="button" onClick={() => remove(i)}
                style={{ background:'none', border:'none', cursor:'pointer', color:'#cbd5e1', fontSize:18, lineHeight:1, padding:0 }}>
                ×
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>Technician:</span>
              <select
                className="form-select"
                value={s.technicianId || ''}
                onChange={e => updateTech(i, Number(e.target.value))}
                style={{ fontSize: 12, padding: '4px 8px', height: 'auto' }}
              >
                {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <label style={{ display:'flex', alignItems:'center', gap:4, cursor:'pointer', whiteSpace:'nowrap', marginLeft:4 }}>
                <input
                  type="checkbox"
                  checked={!!s.techRequested}
                  onChange={e => updateTechRequested(i, e.target.checked)}
                  style={{ width:13, height:13, accentColor:'#ef4444' }}
                />
                <span style={{ fontSize:11, color: s.techRequested ? '#ef4444' : '#94a3b8', fontWeight: s.techRequested ? 700 : 400 }}>
                  Requested
                </span>
              </label>
            </div>
            {i > 0 && timing !== 'sametime' && (
              <div style={{ position: 'relative', marginTop: 5 }}>
                <button
                  type="button"
                  onClick={() => setOpenPicker(pickerOpen ? null : i)}
                  onBlur={() => setTimeout(() => setOpenPicker(null), 150)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                    fontSize: 12, padding: '4px 10px', border: '1px solid #e2e8f0',
                    borderRadius: 6, background: '#fff', cursor: 'pointer', textAlign: 'left',
                    color: s.startTime ? '#1e293b' : '#94a3b8',
                  }}
                >
                  <span>⏰</span>
                  <span style={{ flex: 1 }}>
                    {s.startTime
                      ? formatTime(s.startTime)
                      : calcTime
                        ? `${formatTime(calcTime)} — sequential`
                        : 'Set start time…'}
                  </span>
                  {s.startTime && (
                    <span
                      onMouseDown={e => { e.stopPropagation(); updateStartTime(i, '') }}
                      style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1, cursor: 'pointer', padding: '0 2px' }}
                    >×</span>
                  )}
                </button>
                {pickerOpen && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, zIndex: 400,
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.13)', maxHeight: 200,
                    overflowY: 'auto', minWidth: 170,
                  }}>
                    {TIME_SLOTS.map(t => {
                      const isCalc = t === calcTime
                      const isSel  = t === (s.startTime || calcTime)
                      return (
                        <div key={t}
                          onMouseDown={() => { updateStartTime(i, t); setOpenPicker(null) }}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '6px 12px', cursor: 'pointer', fontSize: 12,
                            background: isSel ? '#e0e7ff' : 'transparent',
                            color: isCalc ? '#4f46e5' : '#1e293b',
                            fontWeight: isSel ? 700 : 400,
                          }}>
                          <span>{formatTime(t)}</span>
                          {isCalc && <span style={{ fontSize: 10, color: '#a5b4fc' }}>sequential</span>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          )
        })}
        {services.length === 0 && (
          <div style={{ fontSize: 13, color: '#94a3b8', padding: '6px 2px' }}>No services added yet.</div>
        )}
        {available.length > 0 && (
          <select className="form-select" value="" onChange={e => e.target.value && addService(e.target.value)}>
            <option value="">+ Add a service…</option>
            {available.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
        )}
      </div>
    </div>
  )
}

/* ── Booking form (new + edit) ──────────────────────────────── */
function BookingForm({ initial, technicians, clients, onSave, onCancel }) {
  // Existing appointments: hydrate technicianId per service from appointment's tech
  const initServices = initial.services?.length
    ? initial.services.map(s => ({ ...s, technicianId: s.technicianId || initial.technicianId || technicians[0]?.id }))
    : initial.service
      ? [{ name: initial.service, duration: initial.duration || 60, technicianId: initial.technicianId || technicians[0]?.id }]
      : []   // start empty for new appointments

  const [form,     setForm]     = useState({ ...initial, techRequested: initial.techRequested || false })
  const [services, setServices] = useState(initServices)
  const [timing,   setTiming]   = useState('sequential')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function handleTimingChange(mode) {
    setTiming(mode)
    if (mode === 'sametime') {
      setServices(prev => prev.map(s => ({ ...s, startTime: form.startTime || undefined })))
    } else {
      setServices(prev => prev.map(s => ({ ...s, startTime: undefined })))
    }
  }

  function handleStartTimeChange(e) {
    const t = e.target.value
    set('startTime', t)
    if (timing === 'sametime') {
      setServices(prev => prev.map(s => ({ ...s, startTime: t || undefined })))
    }
  }

  const totalDuration = services.reduce((sum, s) => sum + s.duration, 0)
  const primaryTech   = technicians.find(t => t.id === (services[0]?.technicianId || form.technicianId))
  const endTime       = totalDuration ? addMinutes(form.startTime, totalDuration) : ''

  function handleSave() {
    if (!form.clientName.trim() || !form.clientPhone?.trim() || !services.length) return
    const primaryTechId = services[0]?.technicianId || form.technicianId
    const anyRequested  = services.some(s => s.techRequested) || form.techRequested
    onSave({
      ...form,
      technicianId:  primaryTechId,
      service:       services.map(s => s.name).join(' + '),
      services,
      duration:      totalDuration,
      techRequested: anyRequested,
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

      <ServiceBuilder
        services={services}
        onChange={setServices}
        technicians={technicians}
        timing={timing}
        defaultTechId={form.technicianId}
        aptStartTime={form.startTime}
      />

      {services.length > 1 && (
        <div style={{ display:'flex', gap:0, marginBottom:12, border:'1px solid #e2e8f0', borderRadius:8, overflow:'hidden', width:'fit-content' }}>
          {['sequential', 'sametime'].map(mode => (
            <button key={mode} type="button" onClick={() => handleTimingChange(mode)} style={{
              padding:'6px 16px', fontSize:12, fontWeight:600, border:'none', cursor:'pointer',
              background: timing === mode ? '#4f46e5' : '#f8fafc',
              color: timing === mode ? '#fff' : '#94a3b8',
            }}>
              {mode === 'sequential' ? 'Sequential' : 'Same Time'}
            </button>
          ))}
        </div>
      )}

      <div style={{ display:'flex', gap:10 }}>
        <div className="form-group" style={{ flex:1 }}>
          <label className="form-label">Date</label>
          <input className="form-input" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
        </div>
        <div className="form-group" style={{ flex:1 }}>
          <label className="form-label">Start Time</label>
          <input className="form-input" type="time" value={form.startTime} onChange={handleStartTimeChange} />
        </div>
      </div>
      {totalDuration > 0 && (
        <div style={{ fontSize:12, color:'#64748b', marginBottom:12 }}>
          {formatTime(form.startTime)} → {formatTime(endTime)} · {totalDuration} min
          {primaryTech && ` · Primary: ${primaryTech.name}`}
        </div>
      )}

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
              initial={{ clientName:'', clientPhone:'', service: '', services: [], technicianId: newData.technicianId, date: newData.date, startTime: newData.time, duration: 0, notes:'', techRequested: false, clientConfirmed: false }}
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
