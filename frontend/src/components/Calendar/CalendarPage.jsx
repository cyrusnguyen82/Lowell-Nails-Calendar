import { useState, useEffect } from 'react'
import dayjs from 'dayjs'
import { useApp } from '../../context/AppContext'
import CalendarView from './CalendarView'
import WeekView from './WeekView'
import MonthView from './MonthView'

export default function CalendarPage({ initDateStr, initView, onDateChange, onViewChange }) {
  const [currentDate, setCurrentDate] = useState(() => {
    if (initDateStr) { const d = dayjs(initDateStr); if (d.isValid()) return d }
    return dayjs()
  })
  const [view, setView] = useState(initView || 'day')

  useEffect(() => {
    const apiUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '';
    fetch(`${apiUrl}/api/business-config`)
      .then(res => res.json())
      .then(data => {
        if (data.businessName) document.title = data.businessName;
      })
      .catch(() => { document.title = "Salon Calendar"; });
  }, []);

  function setDate(d) {
    setCurrentDate(d)
    onDateChange(d.format('YYYY-MM-DD'))
  }

  function changeView(v) {
    setView(v)
    onViewChange(v)
  }

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

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      {/* Toolbar */}
      <div className="cal-toolbar">
        <span className="cal-toolbar-date">
          {isToday && view === 'day' ? 'Today · ' : ''}{navLabel()}
        </span>
        <div className="cal-toolbar-controls">
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

      {/* View */}
      <div style={{ flex:1, overflow:'hidden' }}>
        {view === 'day'   && <CalendarView currentDate={currentDate} />}
        {view === 'week'  && <WeekView currentDate={currentDate} onDayClick={d => { setDate(d); changeView('day') }} />}
        {view === 'month' && <MonthView currentDate={currentDate} onDayClick={d => { setDate(d); changeView('day') }} />}
      </div>
    </div>
  )
}
