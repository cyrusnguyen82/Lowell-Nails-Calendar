import { useState, useEffect } from 'react'
import './Booking.css'

const BASE = import.meta.env.VITE_API_URL || ''

function formatDate(dateStr) {
  const [y, mo, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, mo - 1, d, 12)).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
  })
}

function formatTime(t) {
  const [h, m] = t.split(':').map(Number)
  const ap = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`
}

export default function BookingCancel({ token }) {
  const [appt,       setAppt]       = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [fetchErr,   setFetchErr]   = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [cancelErr,  setCancelErr]  = useState('')
  const [cancelled,  setCancelled]  = useState(false)

  useEffect(() => {
    fetch(`${BASE}/api/book/cancel/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setFetchErr(data.error)
        else setAppt(data)
        setLoading(false)
      })
      .catch(() => { setFetchErr('Could not load appointment details.'); setLoading(false) })
  }, [token])

  async function handleCancel() {
    setCancelling(true)
    setCancelErr('')
    try {
      const res  = await fetch(`${BASE}/api/book/cancel/${token}`, { method: 'POST' })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setCancelled(true)
    } catch (e) {
      setCancelErr(e.message || 'Cancellation failed. Please call us directly.')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="booking-root">
      <div className="booking-header">
        <div className="booking-brand">Lowell Nails &amp; Spa</div>
        <div className="booking-title">Cancel Appointment</div>
      </div>

      <div className="booking-card">

        {/* Loading */}
        {loading && <div className="booking-spinner" />}

        {/* Fetch error */}
        {!loading && fetchErr && (
          <div className="booking-empty">
            {fetchErr === 'Appointment not found'
              ? 'This cancellation link is invalid or has already been used.'
              : fetchErr}
            <br /><br />
            <a href="/book" style={{ color: '#0ea5e9', fontWeight: 600 }}>
              Book a new appointment →
            </a>
          </div>
        )}

        {/* Already cancelled / no-show */}
        {!loading && appt && appt.status !== 'confirmed' && (
          <div className="booking-empty">
            This appointment is already marked as <strong>{appt.status}</strong>.
            <br /><br />
            <a href="/book" style={{ color: '#0ea5e9', fontWeight: 600 }}>
              Book a new appointment →
            </a>
          </div>
        )}

        {/* Cancellation confirmation prompt */}
        {!loading && appt && appt.status === 'confirmed' && !cancelled && (
          <>
            <div className="booking-step-title">Cancel this appointment?</div>
            <div className="booking-step-sub">
              This action cannot be undone. You'll receive a text confirmation.
            </div>

            <div className="booking-confirm-details">
              <div className="booking-confirm-row">
                <span className="booking-confirm-label">Service</span>
                <span className="booking-confirm-val">{appt.service}</span>
              </div>
              <div className="booking-confirm-row">
                <span className="booking-confirm-label">With</span>
                <span className="booking-confirm-val">{appt.techName}</span>
              </div>
              <div className="booking-confirm-row">
                <span className="booking-confirm-label">Date</span>
                <span className="booking-confirm-val">{formatDate(appt.date)}</span>
              </div>
              <div className="booking-confirm-row">
                <span className="booking-confirm-label">Time</span>
                <span className="booking-confirm-val">{formatTime(appt.startTime)}</span>
              </div>
              <div className="booking-confirm-row">
                <span className="booking-confirm-label">Name</span>
                <span className="booking-confirm-val">{appt.clientName}</span>
              </div>
            </div>

            {cancelErr && <div className="booking-error">{cancelErr}</div>}

            <div className="booking-nav" style={{ marginTop: 8 }}>
              <a href="/book" style={{ flex: 1, display: 'block' }}>
                <button className="booking-btn-back" style={{ width: '100%' }}>
                  Keep It
                </button>
              </a>
              <button
                className="booking-btn-next"
                style={{ background: '#ef4444' }}
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelling…' : 'Yes, Cancel'}
              </button>
            </div>
          </>
        )}

        {/* Cancelled successfully */}
        {cancelled && (
          <div className="booking-confirm">
            <div className="booking-confirm-icon" style={{ background: 'rgba(239,68,68,0.08)' }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
                   stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0c1a2e', marginBottom: 6 }}>
              Appointment Cancelled
            </div>
            <div style={{ fontSize: 14, color: '#5a7a9b', lineHeight: 1.6, marginBottom: 24 }}>
              We hope to see you again soon!<br />
              A confirmation text has been sent to your phone.
            </div>
            <a href="/book" style={{ display: 'block' }}>
              <button className="booking-btn-next" style={{ width: '100%' }}>
                Book a New Appointment
              </button>
            </a>
          </div>
        )}
      </div>

      <div className="booking-footer">
        Questions? Call us at <strong>(616) 319-7924</strong>
      </div>
    </div>
  )
}
