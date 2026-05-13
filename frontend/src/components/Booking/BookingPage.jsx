import { useState, useEffect } from 'react'
import './Booking.css'

const BASE = import.meta.env.VITE_API_URL || ''
const apiFetch = (path) => fetch(`${BASE}/api${path}`).then(r => r.json())
const apiPost  = (path, body) => fetch(`${BASE}/api${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
}).then(r => r.json())

const DAY_LABELS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES  = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December']
const STEPS        = ['Service', 'Technician', 'Date', 'Time', 'Your Info']

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

  // Data
  const [services,     setServices]     = useState([])
  const [techs,        setTechs]        = useState([])
  const [slots,        setSlots]        = useState([])
  const [svcLoading,   setSvcLoading]   = useState(true)
  const [techLoading,  setTechLoading]  = useState(true)
  const [slotsLoading, setSlotsLoading] = useState(false)

  // Selections
  const [selService, setSelService] = useState(null)
  const [selTech,    setSelTech]    = useState(null)
  const [selDate,    setSelDate]    = useState('')
  const [selSlot,    setSelSlot]    = useState(null)
  const [name,       setName]       = useState('')
  const [phone,      setPhone]      = useState('')
  const [notes,      setNotes]      = useState('')

  // Result
  const [booking,    setBooking]    = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')

  // Calendar nav
  const now = new Date()
  const [calYear,  setCalYear]  = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())

  /* ── Load services + techs on mount ── */
  useEffect(() => {
    apiFetch('/book/services')
      .then(d => { setServices(Array.isArray(d) ? d : []); setSvcLoading(false) })
      .catch(() => setSvcLoading(false))
    apiFetch('/book/technicians')
      .then(d => { setTechs(Array.isArray(d) ? d : []); setTechLoading(false) })
      .catch(() => setTechLoading(false))
  }, [])

  /* ── Fetch slots when tech + date + service are all selected ── */
  useEffect(() => {
    if (!selDate || !selTech || !selService) return
    setSlotsLoading(true)
    setSlots([])
    setSelSlot(null)

    const dur = selService.duration

    if (selTech.id === 'any') {
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
      apiFetch(`/book/slots?techId=${selTech.id}&date=${selDate}&duration=${dur}`)
        .then(d => {
          setSlots((d.slots || []).map(s => ({ time: s, techId: selTech.id, techName: selTech.name })))
          setSlotsLoading(false)
        })
        .catch(() => setSlotsLoading(false))
    }
  }, [selDate, selTech, selService])

  /* ── Calendar helpers ── */
  function buildCells() {
    const firstDow    = new Date(calYear, calMonth, 1).getDay()
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
    const tStr        = todayStr()
    const cells = []
    for (let i = 0; i < firstDow; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      const ds  = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      const dow = new Date(calYear, calMonth, d).getDay()
      cells.push({ d, ds, disabled: ds < tStr || dow === 0 })
    }
    return cells
  }

  const canPrev = calYear > now.getFullYear() || calMonth > now.getMonth()
  const maxFwdMonths = 2
  const fwdMonth = (now.getMonth() + maxFwdMonths) % 12
  const fwdYear  = now.getMonth() + maxFwdMonths > 11 ? now.getFullYear() + 1 : now.getFullYear()
  const canNext  = calYear < fwdYear || (calYear === fwdYear && calMonth < fwdMonth)

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
      const result = await apiPost('/book', {
        technicianId: selSlot.techId,
        service:      selService.name,
        duration:     selService.duration,
        date:         selDate,
        startTime:    selSlot.time,
        clientName:   name.trim(),
        clientPhone:  digits,
        notes:        notes.trim(),
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
    !!selService,
    !!selTech,
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
    return (
      <div className="booking-services">
        {services.map(s => (
          <button
            key={s.id}
            className={`booking-service-btn${selService?.id === s.id ? ' selected' : ''}`}
            onClick={() => setSelService(s)}
          >
            <div className="booking-service-name">{s.name}</div>
            <div className="booking-service-meta">{fmtDuration(s.duration)}</div>
            {s.price > 0 && (
              <div className="booking-service-price">${Number(s.price).toFixed(0)}</div>
            )}
          </button>
        ))}
      </div>
    )
  }

  function renderTech() {
    if (techLoading) return <div className="booking-spinner" />
    const allTechs = [
      { id: 'any', name: 'Any Available', color: '#0ea5e9', initials: '✦' },
      ...techs,
    ]
    return (
      <div className="booking-techs">
        {allTechs.map(t => (
          <button
            key={t.id}
            className={`booking-tech-btn${selTech?.id === t.id ? ' selected' : ''}`}
            onClick={() => setSelTech(t)}
          >
            <div className="booking-tech-avatar" style={{ background: t.color || '#0ea5e9' }}>
              {t.initials || t.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="booking-tech-name">{t.name}</div>
          </button>
        ))}
      </div>
    )
  }

  function renderDate() {
    const tStr  = todayStr()
    const cells = buildCells()
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
              {selTech?.id === 'any' && (
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
          <strong style={{ color: '#0c1a2e' }}>{selService?.name}</strong>
          {' '}with{' '}
          <strong style={{ color: '#0c1a2e' }}>{selSlot?.techName}</strong>
          <br />
          {selDate && formatDate(selDate)} at {selSlot && formatTime(selSlot.time)}
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
            ? 'We couldn\'t send a confirmation text. Please save your appointment details below.'
            : 'A confirmation text has been sent to your phone.'}
        </div>

        <div className="booking-confirm-details">
          <div className="booking-confirm-row">
            <span className="booking-confirm-label">Service</span>
            <span className="booking-confirm-val">{selService?.name}</span>
          </div>
          <div className="booking-confirm-row">
            <span className="booking-confirm-label">With</span>
            <span className="booking-confirm-val">{selSlot?.techName}</span>
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
          <button
            className="booking-btn-back"
            style={{ flex: 1 }}
            onClick={handleDone}
          >
            Done
          </button>
          <button
            className="booking-btn-next"
            style={{ flex: 2 }}
            onClick={() => window.location.reload()}
          >
            Book Another
          </button>
        </div>
      </div>
    )
  }

  /* ── Step metadata ── */
  const stepMeta = [
    { title: 'Choose a Service',    sub: 'What would you like today?' },
    { title: 'Choose a Technician', sub: 'Who would you like to work with?' },
    { title: 'Choose a Date',       sub: 'When works for you?' },
    { title: 'Choose a Time',       sub: selDate ? `Available on ${formatDate(selDate)}` : 'Pick a time' },
    { title: 'Your Information',    sub: "We'll text you a confirmation" },
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
