import { useState, useRef, useEffect } from 'react'
import dayjs from 'dayjs'
import { useApp } from '../../context/AppContext'
import AppointmentModal from './AppointmentModal'
import './Calendar.css'

const START_HOUR = 8
const END_HOUR = 21
const SLOT_HEIGHT = 60

function timeToOffset(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  return ((h - START_HOUR) * 60 + m) / 30 * SLOT_HEIGHT
}

function formatHour(h) {
  if (h === 12) return '12 PM'
  if (h > 12) return `${h - 12} PM`
  return `${h} AM`
}

function getTimeOffset() {
  const now = new Date()
  const h = now.getHours(), m = now.getMinutes()
  if (h < START_HOUR || h >= END_HOUR) return null
  return ((h - START_HOUR) * 60 + m) / 30 * SLOT_HEIGHT
}

function slotToTime(i) {
  const total = START_HOUR * 60 + i * 30
  const h = Math.floor(total / 60), m = total % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
}

function formatDayTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  const suffix = h >= 12 ? 'pm' : 'am'
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${hour}:${String(m).padStart(2,'0')}${suffix}`
}

export default function WeekView({ currentDate, onDayClick }) {
  const { technicians, appointments, addAppointment, deleteAppointment } = useApp()
  const [selectedApt, setSelectedApt] = useState(null)
  const [newAptData, setNewAptData]   = useState(null)
  const [timeOffset, setTimeOffset]   = useState(getTimeOffset())
  const bodyRef = useRef(null)

  useEffect(() => {
    const id = setInterval(() => setTimeOffset(getTimeOffset()), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (bodyRef.current && timeOffset !== null)
      bodyRef.current.scrollTop = Math.max(0, timeOffset - 180)
  }, [])

  /* Week: Sun–Sat of the currentDate */
  const weekStart = currentDate.startOf('week')
  const days = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'))
  const today = dayjs()
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)
  const totalSlots = (END_HOUR - START_HOUR) * 2

  function aptsForDay(day) {
    return appointments.filter(a => a.date === day.format('YYYY-MM-DD'))
  }

  function techColor(techId) {
    return technicians.find(t => t.id === techId)?.color ?? '#94a3b8'
  }

  function techName(techId) {
    return technicians.find(t => t.id === techId)?.name ?? '—'
  }

  function handleSave(apt) { addAppointment(apt); setNewAptData(null) }
  function handleDelete(id) { deleteAppointment(id); setSelectedApt(null) }

  return (
    <div className="cal-wrapper">
      {/* Day header row */}
      <div className="cal-header-row">
        <div className="cal-header-gutter" />
        <div className="cal-header-techs">
          {days.map(day => {
            const isToday = day.isSame(today, 'day')
            const count = aptsForDay(day).length
            return (
              <div
                key={day.format()}
                className="tech-header-cell"
                style={{ cursor:'pointer', justifyContent:'center', flexDirection:'column', gap:2 }}
                onClick={() => onDayClick(day)}
              >
                <span style={{ fontSize:11, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em' }}>
                  {day.format('ddd')}
                </span>
                <span style={{
                  fontSize:20, fontWeight:700,
                  color: isToday ? '#818cf8' : '#e2e8f0',
                  lineHeight:1,
                }}>
                  {day.format('D')}
                </span>
                {count > 0 && (
                  <span style={{ fontSize:10, color:'#64748b' }}>{count} appt{count !== 1 ? 's' : ''}</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Scrollable grid */}
      <div className="cal-body" ref={bodyRef}>
        <div className="cal-grid">
          <div className="time-gutter">
            {hours.map(h => (
              <div key={h} className="time-slot-label">
                <span className="time-label-hour">{formatHour(h)}</span>
                <span className="time-label-half">:30</span>
              </div>
            ))}
          </div>

          <div className="tech-cols-wrapper">
            {/* Current time line — only if today is in this week */}
            {days.some(d => d.isSame(today,'day')) && timeOffset !== null && (() => {
              const idx = days.findIndex(d => d.isSame(today,'day'))
              const colW = 100 / 7
              return (
                <div className="current-time-line" style={{
                  top: timeOffset,
                  left: `${idx * colW}%`,
                  right: `${(6 - idx) * colW}%`,
                }}>
                  <div className="current-time-dot" />
                </div>
              )
            })()}

            {days.map((day, di) => {
              const dayApts = aptsForDay(day)
              const isToday = day.isSame(today, 'day')
              return (
                <div
                  key={day.format()}
                  className="tech-col"
                  style={{ background: isToday ? 'rgba(99,102,241,0.03)' : undefined }}
                >
                  {/* Click slots */}
                  <div className="time-slots">
                    {Array.from({ length: totalSlots }, (_, i) => (
                      <div
                        key={i}
                        className="slot"
                        onClick={() => setNewAptData({
                          technicianId: technicians[0]?.id,
                          time: slotToTime(i),
                          date: day.format('YYYY-MM-DD'),
                        })}
                      />
                    ))}
                  </div>

                  {/* Appointment blocks */}
                  {dayApts.map(apt => {
                    const top = timeToOffset(apt.startTime)
                    const height = (apt.duration / 30) * SLOT_HEIGHT
                    const color = techColor(apt.technicianId)
                    return (
                      <div
                        key={apt.id}
                        className="apt-block"
                        style={{
                          top: top + 2,
                          height: height - 4,
                          background: color + '22',
                          borderLeftColor: color,
                          color: '#1e293b',
                        }}
                        onClick={e => { e.stopPropagation(); setSelectedApt(apt) }}
                      >
                        <div className="apt-client" style={{ fontSize:11 }}>{apt.clientName}</div>
                        {height > 44 && (
                          <div className="apt-service" style={{ fontSize:10 }}>{apt.service}</div>
                        )}
                        {height > 60 && (
                          <div className="apt-time" style={{ fontSize:10 }}>
                            {formatDayTime(apt.startTime)} · {techName(apt.technicianId)}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {(selectedApt || newAptData) && (
        <AppointmentModal
          appointment={selectedApt}
          newData={newAptData}
          technicians={technicians}
          onClose={() => { setSelectedApt(null); setNewAptData(null) }}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
