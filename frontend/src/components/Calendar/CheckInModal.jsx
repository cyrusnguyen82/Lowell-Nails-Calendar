import { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { SERVICES } from '../../data/mockData'

function nowTime() {
  const d = new Date()
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(Math.floor(d.getMinutes() / 15) * 15).padStart(2, '0')
  return `${h}:${m}`
}

function formatPhone(raw) {
  const d = (raw || '').replace(/\D/g, '').slice(0, 10)
  if (d.length < 4) return d
  if (d.length < 7) return `(${d.slice(0,3)}) ${d.slice(3)}`
  return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`
}

export default function CheckInModal({ onClose, onSave }) {
  const { clients, technicians } = useApp()

  const [search, setSearch]               = useState('')
  const [selectedClient, setSelectedClient] = useState(null)
  const [isNew, setIsNew]                 = useState(false)
  const [newName, setNewName]             = useState('')
  const [newPhone, setNewPhone]           = useState('')
  const [techId, setTechId]               = useState(technicians[0]?.id ?? null)
  const [service, setService]             = useState(SERVICES[0].name)
  const [duration, setDuration]           = useState(SERVICES[0].duration)
  const [startTime, setStartTime]         = useState(nowTime)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clients.slice(0, 7)
    return clients.filter(c =>
      c.name.toLowerCase().includes(q) || (c.phone || '').includes(q)
    ).slice(0, 7)
  }, [search, clients])

  function pickService(name) {
    const svc = SERVICES.find(s => s.name === name)
    setService(name)
    setDuration(svc?.duration ?? 30)
  }

  const clientName  = selectedClient ? selectedClient.name  : newName.trim()
  const clientPhone = selectedClient ? selectedClient.phone : newPhone.trim()
  const canSave     = clientName && techId && service

  function handleSave() {
    if (!canSave) return
    onSave({
      clientName,
      clientPhone: clientPhone || '',
      technicianId: techId,
      service,
      startTime,
      duration,
      date: new Date().toISOString().slice(0, 10),
      notes: '',
      status: 'checkedin',
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal checkin-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-dot" style={{ background:'#10b981' }} />
          <div className="modal-title">Walk-In Check-In</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">

          {/* ── Client ── */}
          <div className="form-group">
            <label className="form-label">Customer</label>

            {!selectedClient && !isNew && (
              <>
                <input
                  className="form-input"
                  placeholder="Search by name or phone…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoFocus
                />
                <div className="checkin-client-list">
                  {filtered.map(c => (
                    <button key={c.id} className="checkin-client-row" onClick={() => setSelectedClient(c)}>
                      <span className="checkin-client-name">{c.name}</span>
                      <span className="checkin-client-phone">{c.phone}</span>
                    </button>
                  ))}
                  <button className="checkin-client-row checkin-new-row" onClick={() => { setIsNew(true); setSearch('') }}>
                    + New customer
                  </button>
                </div>
              </>
            )}

            {isNew && (
              <div style={{ display:'flex', gap:8 }}>
                <input
                  className="form-input"
                  placeholder="Full name *"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  autoFocus
                />
                <input
                  className="form-input"
                  placeholder="Phone"
                  value={newPhone}
                  onChange={e => setNewPhone(formatPhone(e.target.value))}
                  style={{ maxWidth:160 }}
                />
                <button
                  className="btn btn-ghost"
                  style={{ flexShrink:0, padding:'0 10px' }}
                  onClick={() => { setIsNew(false); setNewName(''); setNewPhone('') }}
                >×</button>
              </div>
            )}

            {selectedClient && (
              <div className="checkin-selected-client">
                <div>
                  <div className="checkin-client-name">{selectedClient.name}</div>
                  <div className="checkin-client-phone">{selectedClient.phone}</div>
                </div>
                <button
                  className="checkin-change-btn"
                  onClick={() => { setSelectedClient(null); setSearch('') }}
                >
                  Change
                </button>
              </div>
            )}
          </div>

          {/* ── Technician ── */}
          <div className="form-group">
            <label className="form-label">Technician</label>
            <div className="checkin-tech-pills">
              {technicians.map(t => (
                <button
                  key={t.id}
                  className={`checkin-tech-pill${techId === t.id ? ' active' : ''}`}
                  style={techId === t.id
                    ? { borderColor: t.color, background: t.color + '22', color: t.color }
                    : {}}
                  onClick={() => setTechId(t.id)}
                >
                  {t.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* ── Service ── */}
          <div className="form-group">
            <label className="form-label">Service</label>
            <select className="form-select" value={service} onChange={e => pickService(e.target.value)}>
              {SERVICES.map(s => (
                <option key={s.name} value={s.name}>{s.name} — ${s.price}</option>
              ))}
            </select>
          </div>

          {/* ── Start Time ── */}
          <div className="form-group">
            <label className="form-label">Start Time</label>
            <input
              className="form-input"
              type="time"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              style={{ maxWidth:140 }}
            />
          </div>

        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            style={{ background: canSave ? '#10b981' : undefined, opacity: canSave ? 1 : 0.5 }}
            disabled={!canSave}
            onClick={handleSave}
          >
            Check In
          </button>
        </div>

      </div>
    </div>
  )
}
