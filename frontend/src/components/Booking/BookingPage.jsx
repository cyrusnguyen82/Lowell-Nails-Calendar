import { useState, useEffect, useRef, useMemo } from 'react'
import './Booking.css'

const BASE    = import.meta.env.VITE_API_URL || ''
const apiFetch = (path) => fetch(`${BASE}/api${path}`).then(r => r.json())
const apiPost  = (path, body) => fetch(`${BASE}/api${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
}).then(r => r.json())

const DAY_LABELS  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December']
const STEPS       = ['Services', 'Technicians', 'Date', 'Time', 'Your Info']

const CAT_ORDER  = ['pedi', 'mani', 'acrylic', 'dip', 'gel', 'kids', 'addons']
const CAT_LABELS = {
  pedi: 'Pedicures', mani: 'Manicures', acrylic: 'Acrylics',
  dip: 'Dip Powder', gel: 'Builder Gel', kids: 'Kids', addons: 'Add-Ons',
}

const LIMITED_TECHS = new Set(['Dung', 'Van'])
const ANY_TECH      = { id: 'any', name: 'Any', color: '#0ea5e9', initials: '✦' }

function isAdvancedService(name) {
  const n = name.toLowerCase()
  return (
    n.includes('acrylic') || n.includes('builder gel') || n.includes('dip') ||
    n.includes('pink & white') || n.includes('pink fill') || n.includes('dual form')
  )
}

function getCategory(name) {
  const n = name.toLowerCase()
  if (n.includes('kid') || n.includes('child'))             return 'kids'
  if (n.includes('acrylic') || n.includes('pink') || n.includes('dual form')) return 'acrylic'
  if (n.includes('dip') || n.includes('powder'))            return 'dip'
  if (n.includes('builder gel'))                            return 'gel'
  if (n.includes('pedicure') || n.includes('pedi'))         return 'pedi'
  if (n.includes('manicure') || n.includes('mani') ||
      n.includes('gel polish') || n.includes('shellac'))    return 'mani'
  return 'addons'
}

function formatTime(t) {
  const [h, m] = t.split(':').map(Number)
  const ap = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`
}

function formatDate(dateStr) {
  const [y, mo, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, mo - 1, d, 12)).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
  })
}

function fmtDuration(mins) {
  const m = Number(mins)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60), r = m % 60
  return r ? `${h}h ${r}m` : `${h} hr`
}

function phoneFormat(v) {
  const d = v.replace(/\D/g, '').slice(0, 10)
  if (d.length <= 3) return d
  if (d.length <= 6) return `(${d.slice(0,3)}) ${d.slice(3)}`
  return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`
}

function todayStr() {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`
}

export default function BookingPage() {
  const [step, setStep] = useState(0)

  // Remote data
  const [services,     setServices]     = useState([])
  const [techs,        setTechs]        = useState([])
  const [slots,        setSlots]        = useState([])
  const [svcLoading,   setSvcLoading]   = useState(true)
  const [techLoading,  setTechLoading]  = useState(true)
  const [slotsLoading, setSlotsLoading] = useState(false)

  // Cart — each added service gets a unique itemId
  const itemIdRef = useRef(0)
  const [selServices,     setSelServices]     = useState([])  // [{ ...svcData, itemId }]
  const [techAssignments, setTechAssignments] = useState({})  // { itemId: tech }
  const [groupModes,      setGroupModes]      = useState({})  // { category: 'simultaneous'|'sequential' }

  // Booking
  const [selDate,     setSelDate]     = useState('')
  const [selSlot,     setSelSlot]     = useState(null)
  const [name,        setName]        = useState('')
  const [phone,       setPhone]       = useState('')
  const [notes,       setNotes]       = useState('')

  // Result
  const [booking,    setBooking]    = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')

  // Calendar nav
  const now = new Date()
  const [calYear,  setCalYear]  = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())

  // All tech options including "Any" sentinel
  const allTechOptions = useMemo(() => [ANY_TECH, ...techs], [techs])

  // Services grouped by category in insertion order
  const groupedServices = useMemo(() => {
    const groups = {}
    for (const item of selServices) {
      const cat = getCategory(item.name)
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(item)
    }
    return CAT_ORDER.filter(c => groups[c]).map(c => ({ cat: c, items: groups[c] }))
  }, [selServices])

  // Duration respects simultaneous vs sequential per category
  const totalDuration = useMemo(() => {
    if (groupedServices.length === 0) return 0
    return groupedServices.reduce((total, { cat, items }) => {
      const mode = groupModes[cat] || 'simultaneous'
      if (mode === 'simultaneous') return total + Math.max(...items.map(s => s.duration))
      return total + items.reduce((sum, s) => sum + s.duration, 0)
    }, 0)
  }, [groupedServices, groupModes])

  // Primary tech for slot fetching: most-specific non-"any" tech for the longest service
  const primaryTech = useMemo(() => {
    let best = null, bestDur = 0
    for (const item of selServices) {
      const t = techAssignments[item.itemId]
      if (t && t.id !== 'any' && item.duration > bestDur) {
        best = t; bestDur = item.duration
      }
    }
    return best || ANY_TECH
  }, [selServices, techAssignments])

  /* ── Load services + techs on mount ── */
  useEffect(() => {
    apiFetch('/book/services')
      .then(d => { setServices(Array.isArray(d) ? d : []); setSvcLoading(false) })
      .catch(() => setSvcLoading(false))
    apiFetch('/book/technicians')
      .then(d => { setTechs(Array.isArray(d) ? d : []); setTechLoading(false) })
      .catch(() => setTechLoading(false))
  }, [])

  /* ── Fetch slots when date / primary tech / duration change ── */
  useEffect(() => {
    if (!selDate || selServices.length === 0) return
    setSlotsLoading(true)
    setSlots([])
    setSelSlot(null)
    const dur = totalDuration

    if (primaryTech.id === 'any') {
      Promise.all(
        techs.map(t =>
          apiFetch(`/book/slots?techId=${t.id}&date=${selDate}&duration=${dur}`)
            .then(d => (d.slots || []).map(s => ({ time: s, techId: t.id, techName: t.name })))
            .catch(() => [])
        )
      ).then(results => {
        const seen = new Set()
        const merged = []
        for (const s of results.flat().sort((a, b) => a.time.localeCompare(b.time))) {
          if (!seen.has(s.time)) { seen.add(s.time); merged.push(s) }
        }
        setSlots(merged.slice(0, 6))
        setSlotsLoading(false)
      })
    } else {
      apiFetch(`/book/slots?techId=${primaryTech.id}&date=${selDate}&duration=${dur}`)
        .then(d => {
          setSlots((d.slots || []).map(s => ({ time: s, techId: primaryTech.id, techName: primaryTech.name })))
          setSlotsLoading(false)
        })
        .catch(() => setSlotsLoading(false))
    }
  }, [selDate, primaryTech, totalDuration])  // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Cart helpers ── */
  function addService(svc) {
    const item = { ...svc, itemId: ++itemIdRef.current }
    setSelServices(prev => [...prev, item])
    setTechAssignments(prev => ({ ...prev, [item.itemId]: ANY_TECH }))
    setSelSlot(null)
  }

  function removeService(itemId) {
    setSelServices(prev => prev.filter(s => s.itemId !== itemId))
    setTechAssignments(prev => { const n = { ...prev }; delete n[itemId]; return n })
    setSelSlot(null)
  }

  /* ── Calendar helpers ── */
  function buildCells() {
    const firstDow    = new Date(calYear, calMonth, 1).getDay()
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
    const tStr        = todayStr()
    const cells       = []
    for (let i = 0; i < firstDow; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      const ds  = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      const dow = new Date(calYear, calMonth, d).getDay()
      cells.push({ d, ds, disabled: ds < tStr || dow === 0 })
    }
    return cells
  }

  const canPrev      = calYear > now.getFullYear() || calMonth > now.getMonth()
  const maxFwdMonths = 2
  const fwdMonth     = (now.getMonth() + maxFwdMonths) % 12
  const fwdYear      = now.getMonth() + maxFwdMonths > 11 ? now.getFullYear() + 1 : now.getFullYear()
  const canNext      = calYear < fwdYear || (calYear === fwdYear && calMonth < fwdMonth)

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) }
    else setCalMonth(m => m - 1)
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) }
    else setCalMonth(m => m + 1)
  }

  /* ── Submit ── */
  async function handleSubmit() {
    const digits = phone.replace(/\D/g, '')
    if (!name.trim())         { setError('Please enter your name.'); return }
    if (digits.length !== 10) { setError('Please enter a valid 10-digit phone number.'); return }
    setError('')
    setSubmitting(true)
    try {
      const servicePayload = selServices.map(item => {
        const t = techAssignments[item.itemId]
        return {
          name:         item.name,
          duration:     item.duration,
          technicianId: (!t || t.id === 'any') ? selSlot.techId : t.id,
        }
      })
      const result = await apiPost('/book', {
        technicianId:   selSlot.techId,
        service:        selServices.map(s => s.name).join(' + '),
        services:       servicePayload,
        duration:       totalDuration,
        date:           selDate,
        startTime:      selSlot.time,
        schedulingMode: groupModes,
        clientName:     name.trim(),
        clientPhone:    digits,
        notes:          notes.trim(),
      })
      if (result.error) throw new Error(result.error)
      setBooking(result)
      setStep(5)
    } catch (e) {
      setError(e.message || 'Booking failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Can advance from each step ── */
  const canAdvance = [
    selServices.length > 0,
    true,  // all services default to ANY_TECH
    !!selDate,
    !!selSlot,
    name.trim().length > 0 && phone.replace(/\D/g, '').length === 10,
  ][step] ?? false

  /* ── Step renderers ── */
  function renderService() {
    if (svcLoading) return <div className="booking-spinner" />
    if (!services.length) return (
      <div className="booking-empty">
        No services available for online booking right now.<br />
        Call us at <strong>(616) 319-7924</strong> to schedule.
      </div>
    )

    // Cart counts by service ID
    const cartCounts = selServices.reduce((acc, s) => {
      acc[s.id] = (acc[s.id] || 0) + 1; return acc
    }, {})

    // Group catalog services by category
    const svcGroups = {}
    for (const s of services) {
      const cat = getCategory(s.name)
      if (!svcGroups[cat]) svcGroups[cat] = []
      svcGroups[cat].push(s)
    }

    // Unique services in cart for the stepper
    const cartGroups = selServices.reduce((acc, s) => {
      const g = acc.find(x => x.s.id === s.id)
      if (g) g.count++
      else acc.push({ s, count: 1 })
      return acc
    }, [])

    return (
      <div>
        {CAT_ORDER.filter(c => svcGroups[c]).map(cat => (
          <div key={cat} className="booking-svc-section">
            <div className="booking-svc-section-header">{CAT_LABELS[cat]}</div>
            <div className="booking-services">
              {svcGroups[cat].map(s => {
                const count = cartCounts[s.id] || 0
                return (
                  <button
                    key={s.id}
                    className={`booking-service-btn${count > 0 ? ' selected' : ''}`}
                    onClick={() => addService(s)}
                  >
                    <div className="booking-service-name">{s.name}</div>
                    <div className="booking-service-meta">{fmtDuration(s.duration)}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                      {s.price > 0
                        ? <div className="booking-service-price" style={{ margin: 0 }}>${Number(s.price).toFixed(0)}</div>
                        : <div />}
                      {count > 0 && (
                        <div style={{
                          background: '#0ea5e9', color: '#fff', borderRadius: 10,
                          fontSize: 11, fontWeight: 800, padding: '2px 8px', lineHeight: 1.4,
                        }}>×{count}</div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        {cartGroups.length > 0 && (
          <div style={{
            marginTop: 14, background: '#f0f8ff', borderRadius: 10,
            border: '1px solid #bae0f5', padding: '10px 14px',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0284c7', marginBottom: 8 }}>
              {selServices.length} service{selServices.length > 1 ? 's' : ''} · {fmtDuration(totalDuration)} total
            </div>
            {cartGroups.map(({ s, count }) => (
              <div key={s.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 0', borderBottom: '1px solid #dbeafe',
              }}>
                <div>
                  <div style={{ fontSize: 13, color: '#0c1a2e', fontWeight: 600 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: '#64a8c8' }}>
                    {fmtDuration(s.duration)}{count > 1 ? ` × ${count}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      const last = [...selServices].reverse().find(x => x.id === s.id)
                      if (last) removeService(last.itemId)
                    }}
                    style={{ width: 28, height: 28, border: '1px solid #bae0f5', borderRadius: '6px 0 0 6px', background: '#fff', cursor: 'pointer', fontSize: 16, color: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}
                  >−</button>
                  <div style={{ width: 28, height: 28, border: '1px solid #bae0f5', borderTop: '1px solid #bae0f5', borderBottom: '1px solid #bae0f5', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#0c1a2e' }}>{count}</div>
                  <button
                    onClick={e => { e.stopPropagation(); addService(s) }}
                    style={{ width: 28, height: 28, border: '1px solid #bae0f5', borderRadius: '0 6px 6px 0', background: '#0ea5e9', cursor: 'pointer', fontSize: 16, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}
                  >+</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  function renderTech() {
    if (techLoading) return <div className="booking-spinner" />

    return (
      <div className="booking-tech-groups">
        {groupedServices.map(({ cat, items }) => {
          const mode = groupModes[cat] || 'simultaneous'
          return (
            <div key={cat} className="booking-tech-group">

              {/* Group header */}
              <div className="booking-tech-group-header">
                <span className="booking-tech-group-label">
                  {CAT_LABELS[cat]}
                  <span className="booking-tech-group-count">{items.length}</span>
                </span>
                {items.length > 1 && (
                  <div className="booking-timing-toggle">
                    <button
                      className={`booking-timing-btn${mode === 'simultaneous' ? ' active' : ''}`}
                      onClick={() => { setGroupModes(prev => ({ ...prev, [cat]: 'simultaneous' })); setSelSlot(null) }}
                    >Same time</button>
                    <button
                      className={`booking-timing-btn${mode === 'sequential' ? ' active' : ''}`}
                      onClick={() => { setGroupModes(prev => ({ ...prev, [cat]: 'sequential' })); setSelSlot(null) }}
                    >One after another</button>
                  </div>
                )}
              </div>

              {/* Per-service tech picker */}
              {items.map(item => {
                const eligible = allTechOptions.filter(t =>
                  t.id === 'any' || !LIMITED_TECHS.has(t.name) || !isAdvancedService(item.name)
                )
                const assigned = techAssignments[item.itemId] || ANY_TECH
                return (
                  <div key={item.itemId} className="booking-service-assign">
                    <div className="booking-assign-info">
                      <span className="booking-assign-service-name">{item.name}</span>
                      <span className="booking-assign-duration">{fmtDuration(item.duration)}</span>
                      {items.length > 1 && (
                        <span className={`booking-assign-mode-badge ${mode}`}>
                          {mode === 'simultaneous' ? 'at the same time' : 'one after another'}
                        </span>
                      )}
                    </div>
                    <div className="booking-assign-techs">
                      {eligible.map(t => {
                        const isSelected = assigned.id === t.id
                        return (
                          <button
                            key={t.id}
                            className={`booking-assign-tech-btn${isSelected ? ' selected' : ''}`}
                            onClick={() => setTechAssignments(prev => ({ ...prev, [item.itemId]: t }))}
                            title={t.name}
                          >
                            <div
                              className="booking-assign-avatar"
                              style={{ background: isSelected ? (t.color || '#0ea5e9') : undefined }}
                            >
                              {t.initials || t.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="booking-assign-name">
                              {t.id === 'any' ? 'Any' : t.name}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    )
  }

  function renderDate() {
    const cells = buildCells()
    const tStr  = todayStr()
    return (
      <>
        <div className="booking-cal-header">
          <button className="booking-cal-nav" onClick={prevMonth} disabled={!canPrev}>‹</button>
          <span className="booking-cal-month">{MONTH_NAMES[calMonth]} {calYear}</span>
          <button className="booking-cal-nav" onClick={nextMonth} disabled={!canNext}>›</button>
        </div>
        <div className="booking-cal">
          {DAY_LABELS.map(l => (
            <div key={l} className="booking-cal-day-label">{l}</div>
          ))}
          {cells.map((cell, i) => {
            if (!cell) return <div key={`e${i}`} className="booking-cal-day empty" />
            const isSelected = selDate === cell.ds
            const isToday    = cell.ds === tStr
            return (
              <button
                key={cell.ds}
                className={`booking-cal-day${isSelected ? ' selected' : ''}${isToday ? ' today' : ''}`}
                disabled={cell.disabled}
                onClick={() => { setSelDate(cell.ds); setSelSlot(null) }}
              >
                {cell.d}
              </button>
            )
          })}
        </div>
      </>
    )
  }

  function renderTime() {
    if (slotsLoading) return <div className="booking-spinner" />
    if (!slots.length) return (
      <div className="booking-empty">
        No available times on {selDate ? formatDate(selDate) : 'that date'}.<br />
        Go back and try a different day.
      </div>
    )
    return (
      <div className="booking-slots">
        {slots.map(s => {
          const isSelected = selSlot?.time === s.time && selSlot?.techId === s.techId
          return (
            <button
              key={`${s.time}-${s.techId}`}
              className={`booking-slot-btn${isSelected ? ' selected' : ''}`}
              onClick={() => setSelSlot(s)}
            >
              <div className="booking-slot-time">{formatTime(s.time)}</div>
              {primaryTech.id === 'any' && (
                <div className="booking-slot-tech">w/ {s.techName}</div>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  function renderInfo() {
    return (
      <>
        <div className="booking-form-group">
          <label className="booking-label">Full Name *</label>
          <input
            className="booking-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Jane Smith"
            autoComplete="name"
          />
        </div>
        <div className="booking-form-group">
          <label className="booking-label">Phone Number *</label>
          <input
            className="booking-input"
            value={phone}
            onChange={e => setPhone(phoneFormat(e.target.value))}
            placeholder="(616) 555-0123"
            inputMode="tel"
            autoComplete="tel"
          />
          <div style={{ fontSize: 11, color: '#9dbdd8', lineHeight: 1.6, marginTop: 2 }}>
            By entering your number you agree to receive appointment SMS from Lowell Nails &amp; Spa.
            Msg &amp; data rates may apply. Reply STOP to opt out.{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer"
               style={{ color: '#0ea5e9', textDecoration: 'none' }}>Privacy Policy</a>
          </div>
        </div>
        <div className="booking-form-group" style={{ marginBottom: 0 }}>
          <label className="booking-label">Notes (optional)</label>
          <input
            className="booking-input"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any special requests?"
          />
        </div>

        <div className="booking-summary-box">
          {groupedServices.map(({ cat, items }) => {
            const mode = groupModes[cat] || 'simultaneous'
            return (
              <div key={cat} style={{ marginBottom: 10 }}>
                <div style={{ fontWeight: 700, color: '#0c1a2e', fontSize: 13, marginBottom: 4 }}>
                  {CAT_LABELS[cat]}
                  {items.length > 1 && (
                    <span style={{ fontSize: 11, fontWeight: 400, color: '#7a9ab8', marginLeft: 6 }}>
                      {mode === 'simultaneous' ? '· same time' : '· one after another'}
                    </span>
                  )}
                </div>
                {items.map(item => {
                  const t = techAssignments[item.itemId] || ANY_TECH
                  return (
                    <div key={item.itemId} style={{ fontSize: 13, color: '#5a7a9b', paddingLeft: 8, lineHeight: 1.8 }}>
                      {item.name} ·{' '}
                      <span style={{ color: '#0ea5e9', fontWeight: 600 }}>
                        w/ {t.id === 'any' ? (selSlot?.techName || 'Any Available') : t.name}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}
          <div style={{ fontSize: 13, color: '#5a7a9b', borderTop: '1px solid #dbeafe', paddingTop: 8, marginTop: 2 }}>
            {selDate && formatDate(selDate)} at {selSlot && formatTime(selSlot.time)}
            <span style={{ color: '#9dbdd8' }}> · {fmtDuration(totalDuration)}</span>
          </div>
        </div>

        {error && <div className="booking-error">{error}</div>}
      </>
    )
  }

  function renderConfirmation() {
    function handleDone() {
      window.location.href = 'http://www.lowellnailsandspa.com'
    }
    return (
      <div className="booking-confirm">
        <div className="booking-confirm-icon" style={{ background: 'rgba(14,165,233,0.1)' }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none"
               stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <div style={{ fontSize: 21, fontWeight: 800, color: '#0c1a2e', marginBottom: 6 }}>
          You're all set!
        </div>
        <div style={{ fontSize: 14, color: booking?.smsOk === false ? '#ef4444' : '#5a7a9b', lineHeight: 1.6 }}>
          {booking?.smsOk === false
            ? "We couldn't send a confirmation text. Please save your appointment details below."
            : 'A confirmation text has been sent to your phone.'}
        </div>

        <div className="booking-confirm-details">
          {groupedServices.map(({ cat, items }) => {
            const mode = groupModes[cat] || 'simultaneous'
            return (
              <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="booking-confirm-label">{CAT_LABELS[cat]}</span>
                  {items.length > 1 && (
                    <span style={{ fontSize: 11, color: '#7a9ab8' }}>
                      {mode === 'simultaneous' ? 'same time' : 'one after another'}
                    </span>
                  )}
                </div>
                {items.map(item => {
                  const t = techAssignments[item.itemId] || ANY_TECH
                  return (
                    <div key={item.itemId} style={{ fontSize: 13, paddingLeft: 8, color: '#0c1a2e', fontWeight: 600 }}>
                      {item.name} ·{' '}
                      <span style={{ color: '#0ea5e9' }}>
                        w/ {t.id === 'any' ? (selSlot?.techName || 'Any') : t.name}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}
          <div className="booking-confirm-row">
            <span className="booking-confirm-label">Duration</span>
            <span className="booking-confirm-val">{fmtDuration(totalDuration)}</span>
          </div>
          <div className="booking-confirm-row">
            <span className="booking-confirm-label">Date</span>
            <span className="booking-confirm-val">{selDate && formatDate(selDate)}</span>
          </div>
          <div className="booking-confirm-row">
            <span className="booking-confirm-label">Time</span>
            <span className="booking-confirm-val">{selSlot && formatTime(selSlot.time)}</span>
          </div>
        </div>

        <div className="booking-cancel-link">
          Need to cancel?{' '}
          <a href={booking?.cancelUrl}>Cancel this appointment</a>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button className="booking-btn-back" style={{ flex: 1 }} onClick={handleDone}>Done</button>
          <button className="booking-btn-next" style={{ flex: 2 }} onClick={() => window.location.reload()}>Book Another</button>
        </div>
      </div>
    )
  }

  /* ── Step metadata ── */
  const stepMeta = [
    { title: 'Choose Services',    sub: 'Tap to add — you can add more than one' },
    { title: 'Assign Technicians', sub: 'Choose who does each service' },
    { title: 'Choose a Date',      sub: 'When works for you?' },
    { title: 'Choose a Time',      sub: selDate ? `Available on ${formatDate(selDate)}` : 'Pick a time' },
    { title: 'Your Information',   sub: "We'll text you a confirmation" },
  ]

  const renderStep = () => {
    if (step === 5) return renderConfirmation()
    switch (step) {
      case 0: return renderService()
      case 1: return renderTech()
      case 2: return renderDate()
      case 3: return renderTime()
      case 4: return renderInfo()
    }
  }

  return (
    <div className="booking-root">
      <div className="booking-header">
        <div className="booking-brand">Lowell Nails &amp; Spa</div>
        <div className="booking-title">Book an Appointment</div>
      </div>

      {step < 5 && (
        <div className="booking-steps">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`booking-step-dot${i === step ? ' active' : i < step ? ' done' : ''}`}
            />
          ))}
        </div>
      )}

      <div className="booking-card">
        {step < 5 && (
          <>
            <div className="booking-step-title">{stepMeta[step].title}</div>
            <div className="booking-step-sub">{stepMeta[step].sub}</div>
          </>
        )}

        <div className="booking-card-body">
          {renderStep()}
        </div>

        {step < 5 && (
          <div className="booking-nav">
            {step > 0 && (
              <button className="booking-btn-back" onClick={() => { setStep(s => s - 1); setError('') }}>
                Back
              </button>
            )}
            {step < 4 ? (
              <button
                className="booking-btn-next"
                disabled={!canAdvance}
                onClick={() => setStep(s => s + 1)}
              >
                Continue
              </button>
            ) : (
              <button
                className="booking-btn-next"
                disabled={!canAdvance || submitting}
                onClick={handleSubmit}
              >
                {submitting ? 'Booking…' : 'Confirm Booking'}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="booking-footer">
        Questions? Call us at <strong>(616) 319-7924</strong>
        <br />
        <a href="https://lowellnailsandspa.com">lowellnailsandspa.com</a>
      </div>
    </div>
  )
}
