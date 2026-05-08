import { useState, useEffect } from 'react'
import dayjs from 'dayjs'
import { useApp } from '../../context/AppContext'
import CalendarView from './CalendarView'
import WeekView from './WeekView'
import MonthView from './MonthView'

const CAL_KEY = 'lowell_nails_cal'

function loadCalState() {
  try {
    const raw = sessionStorage.getItem(CAL_KEY)
    if (!raw) return null
    const { date, view } = JSON.parse(raw)
    return { date: dayjs(date), view }
  } catch { return null }
}

export default function CalendarPage() {
  const stored = loadCalState()
  const [currentDate, setCurrentDate] = useState(stored?.date ?? dayjs())
  const [view, setView] = useState(stored?.view ?? 'day')

  useEffect(() => {
    sessionStorage.setItem(CAL_KEY, JSON.stringify({
      date: currentDate.format('YYYY-MM-DD'),
      view,
    }))
  }, [currentDate, view])

  function nav(amount, unit) { setCurrentDate(d => d.add(amount, unit)) }
  function goToday() { setCurrentDate(dayjs()) }

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
      <div style={{
        display:'flex', alignItems:'center', gap:10,
        padding:'10px 18px', background:'#0f172a', flexShrink:0,
        borderBottom:'1px solid #1e293b',
      }}>
        <button className="nav-btn" onClick={() => nav(-1, navUnit())}>‹ Prev</button>
        <button className="nav-btn today" onClick={goToday}>Today</button>
        <button className="nav-btn" onClick={() => nav(1, navUnit())}>Next ›</button>

        <span style={{ fontSize:15, fontWeight:600, color:'#f1f5f9', minWidth:240, textAlign:'center' }}>
          {isToday && view === 'day' ? 'Today · ' : ''}{navLabel()}
        </span>

        <div style={{ flex:1 }} />

        {/* View toggle */}
        <div style={{ display:'flex', gap:2, background:'#1e293b', padding:3, borderRadius:8 }}>
          {['day','week','month'].map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding:'5px 14px', border:'none', borderRadius:6,
                fontSize:13, fontWeight:600, cursor:'pointer',
                fontFamily:'inherit',
                background: view === v ? '#4f46e5' : 'transparent',
                color:      view === v ? '#fff'    : '#94a3b8',
                transition:'background 0.15s, color 0.15s',
              }}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* View */}
      <div style={{ flex:1, overflow:'hidden' }}>
        {view === 'day'   && <CalendarView currentDate={currentDate} />}
        {view === 'week'  && <WeekView currentDate={currentDate} onDayClick={d => { setCurrentDate(d); setView('day') }} />}
        {view === 'month' && <MonthView currentDate={currentDate} onDayClick={d => { setCurrentDate(d); setView('day') }} />}
      </div>
    </div>
  )
}
