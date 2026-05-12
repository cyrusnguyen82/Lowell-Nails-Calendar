import { useState, useEffect } from 'react'
import dayjs from 'dayjs'
import { useApp } from '../../context/AppContext'
import CalendarView from './CalendarView'
import WeekView from './WeekView'
import MonthView from './MonthView'
import CheckInModal from './CheckInModal'

export default function CalendarPage({ initDateStr, initView, onDateChange, onViewChange, onNavigate }) {
  const { addAppointment, companyInfo } = useApp()
  const [currentDate, setCurrentDate] = useState(() => {
    if (initDateStr) { const d = dayjs(initDateStr); if (d.isValid()) return d }
    return dayjs()
  })
  const [view, setView]               = useState(initView || 'day')
  const [showCheckIn, setShowCheckIn] = useState(false)

  useEffect(() => { document.title = 'Salon Calendar' }, [])

  function setDate(d) {
    setCurrentDate(d)
    onDateChange(d.format('YYYY-MM-DD'))
  }
  function changeView(v) { setView(v); onViewChange(v) }
  function nav(amount, unit) { setDate(currentDate.add(amount, unit)) }
  function goToday() { setDate(dayjs()) }

  const isToday = currentDate.isSame(dayjs(), 'day')

  function navLabel() {
    if (view === 'day')   return currentDate.format('dddd, MMMM D, YYYY')
    if (view === 'month') return currentDate.format('MMMM YYYY')
    const start = currentDate.startOf('week')
    const end   = currentDate.endOf('week')
    if (start.month() === end.month())
      return `${start.format('MMM D')} – ${end.format('D, YYYY')}`
    return `${start.format('MMM D')} – ${end.format('MMM D, YYYY')}`
  }
  function navUnit() {
    return view === 'day' ? 'day' : view === 'week' ? 'week' : 'month'
  }

  function handleCheckInSave(apt) {
    addAppointment(apt)
    setShowCheckIn(false)
  }

  function handleCashOut(apt) {
    try {
      sessionStorage.setItem('lowell_cashout', JSON.stringify({
        clientName:   apt.clientName,
        clientPhone:  apt.clientPhone,
        service:      apt.service,
        technicianId: apt.technicianId,
        aptId:        apt.id,
      }))
    } catch {}
    if (onNavigate) onNavigate('pos')
  }

  const logo = companyInfo?.logoUrl || '/logo.png'
  const name = companyInfo?.name    || 'Lowell Nails & Spa'

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>

      {/* Toolbar */}
      <div className="cal-toolbar">

        {/* Brand mark */}
        <div className="cal-brand">
          <img
            src={logo}
            alt="logo"
            className="cal-brand-logo"
            onError={e => { e.target.style.display = 'none' }}
          />
          <span className="cal-brand-name">{name}</span>
        </div>

        {/* Date */}
        <span className="cal-toolbar-date">
          {isToday && view === 'day' ? 'Today · ' : ''}{navLabel()}
        </span>

        {/* Controls */}
        <div className="cal-toolbar-controls">
          {/* Check-In button */}
          <button className="checkin-btn" onClick={() => setShowCheckIn(true)}>
            + Check In
          </button>

          <div className="cal-toolbar-nav">
            <button className="nav-btn" onClick={() => nav(-1, navUnit())}>‹ Prev</button>
            <button className="nav-btn today" onClick={goToday}>Today</button>
            <button className="nav-btn" onClick={() => nav(1, navUnit())}>Next ›</button>
          </div>
          <div className="cal-toolbar-views">
            {['day','week','month'].map(v => (
              <button
                key={v}
                onClick={() => changeView(v)}
                className={`view-btn${view === v ? ' active' : ''}`}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar view */}
      <div style={{ flex:1, overflow:'hidden' }}>
        {view === 'day'   && <CalendarView currentDate={currentDate} onCashOut={handleCashOut} />}
        {view === 'week'  && <WeekView currentDate={currentDate} onDayClick={d => { setDate(d); changeView('day') }} />}
        {view === 'month' && <MonthView currentDate={currentDate} onDayClick={d => { setDate(d); changeView('day') }} />}
      </div>

      {/* Check-in modal */}
      {showCheckIn && (
        <CheckInModal
          onClose={() => setShowCheckIn(false)}
          onSave={handleCheckInSave}
        />
      )}

    </div>
  )
}
