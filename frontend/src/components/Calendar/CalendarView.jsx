import { useState, useEffect, useRef } from 'react'
import dayjs from 'dayjs'
import { useApp } from '../../context/AppContext'
import TechnicianColumn from './TechnicianColumn'
import AppointmentModal from './AppointmentModal'
import './Calendar.css'

const START_HOUR = 8
const END_HOUR = 21
const SLOT_HEIGHT = 30    // 30px per 15-min slot → 120px/hr, same visual scale as before
const SLOT_MINS  = 15

function formatHour(h) {
  if (h === 12) return '12 PM'
  if (h > 12) return `${h - 12} PM`
  return `${h} AM`
}

function getTimeOffset() {
  const now = new Date()
  const h = now.getHours(), m = now.getMinutes()
  if (h < START_HOUR || h >= END_HOUR) return null
  return ((h - START_HOUR) * 60 + m) / SLOT_MINS * SLOT_HEIGHT
}

export default function CalendarView({ currentDate }) {
  const { user, technicians, appointments, addAppointment, deleteAppointment } = useApp()
  const [selectedApt, setSelectedApt] = useState(null)
  const [newAptData, setNewAptData]   = useState(null)
  const [timeOffset, setTimeOffset]   = useState(getTimeOffset())
  const bodyRef = useRef(null)

  const isToday = currentDate.isSame(dayjs(), 'day')

  useEffect(() => {
    const id = setInterval(() => setTimeOffset(getTimeOffset()), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (bodyRef.current && timeOffset !== null) {
      bodyRef.current.scrollTop = Math.max(0, timeOffset - 180)
    }
  }, [])

  const dateStr = currentDate.format('YYYY-MM-DD')
  const todayApts = appointments.filter(a => a.date === dateStr)

  /* Technicians filter: technician role sees only their own column */
  const visibleTechs = user.role === 'technician'
    ? technicians.filter(t => t.id === user.technicianId)
    : technicians

  function aptsByTech(techId) {
    return todayApts.filter(a => a.technicianId === techId)
  }

  function handleSave(apt) {
    addAppointment(apt)
    setNewAptData(null)
  }

  function handleDelete(id) {
    deleteAppointment(id)
    setSelectedApt(null)
  }

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

  return (
    <div className="cal-wrapper">
      {/* Sticky tech header */}
      <div className="cal-header-row">
        <div className="cal-header-gutter" />
        <div className="cal-header-techs">
          {visibleTechs.map(tech => (
            <div key={tech.id} className="tech-header-cell">
              <div className="tech-avatar" style={{ background: tech.color }}>{tech.initials}</div>
              <span className="tech-name">{tech.name}</span>
              <span className="tech-apt-count">{aptsByTech(tech.id).length} appts</span>
            </div>
          ))}
        </div>
      </div>

      {/* Scrollable grid */}
      <div className="cal-body" ref={bodyRef}>
        <div className="cal-grid">
          <div className="time-gutter">
            {hours.map(h => (
              <div key={h} className="time-slot-label">
                <span className="time-label-hour">{formatHour(h)}</span>
                <span className="time-label-quarter">:15</span>
                <span className="time-label-half">:30</span>
                <span className="time-label-quarter">:45</span>
              </div>
            ))}
          </div>

          <div className="tech-cols-wrapper">
            {isToday && timeOffset !== null && (
              <div className="current-time-line" style={{ top: timeOffset }}>
                <div className="current-time-dot" />
              </div>
            )}
            {visibleTechs.map(tech => (
              <TechnicianColumn
                key={tech.id}
                technician={tech}
                appointments={aptsByTech(tech.id)}
                onSlotClick={time => setNewAptData({ technicianId: tech.id, time, date: dateStr })}
                onAppointmentClick={setSelectedApt}
              />
            ))}
          </div>
        </div>
      </div>

      {(selectedApt || newAptData) && (
        <AppointmentModal
          appointment={selectedApt}
          newData={newAptData}
          technicians={visibleTechs}
          onClose={() => { setSelectedApt(null); setNewAptData(null) }}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
