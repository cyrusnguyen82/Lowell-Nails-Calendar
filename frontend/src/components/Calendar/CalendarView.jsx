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

export default function CalendarView({ currentDate, onCashOut }) {
  const { user, technicians, appointments, addAppointment, updateAppointment, deleteAppointment } = useApp()
  const [selectedApt, setSelectedApt] = useState(null)
  const [newAptData, setNewAptData]   = useState(null)
  const [timeOffset, setTimeOffset]   = useState(getTimeOffset())
  const scrollRef = useRef(null)  // single scroll container for header + body

  const isToday = currentDate.isSame(dayjs(), 'day')

  useEffect(() => {
    const id = setInterval(() => setTimeOffset(getTimeOffset()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Auto-scroll to current time on mount
  useEffect(() => {
    if (scrollRef.current && timeOffset !== null) {
      scrollRef.current.scrollTop = Math.max(0, timeOffset - 180)
    }
  }, [])

  const dateStr = currentDate.format('YYYY-MM-DD')
  const todayApts = appointments.filter(a => a.date === dateStr)

  /* Technicians filter: technician role sees only their own column */
  const visibleTechs = user.role === 'technician'
    ? technicians.filter(t => t.id === user.technicianId)
    : technicians

  function addMins(t, mins) {
    const [h, m] = t.split(':').map(Number)
    const total = h * 60 + m + mins
    return `${String(Math.floor(total / 60)).padStart(2,'0')}:${String(total % 60).padStart(2,'0')}`
  }

  /* For multi-service appointments, each service renders in its assigned tech's column */
  function aptsByTech(techId) {
    const blocks = []
    for (const apt of todayApts) {
      if (!apt.services || apt.services.length <= 1) {
        if (apt.technicianId === techId) blocks.push({ ...apt, _blockKey: String(apt.id) })
      } else {
        let runningTime = apt.startTime
        apt.services.forEach((svc, idx) => {
          const svcTechId = svc.technicianId || apt.technicianId
          const svcStart  = svc.startTime || runningTime
          if (svcTechId === techId) {
            blocks.push({
              ...apt,
              startTime: svcStart,
              duration:  svc.duration,
              service:   svc.name,
              _blockKey: `${apt.id}-${idx}`,
              _originalApt: apt,
            })
          }
          runningTime = addMins(runningTime, svc.duration)
        })
      }
    }
    return blocks
  }

  /* Count unique appointments (not service-split blocks) for header */
  function aptCountForTech(techId) {
    const ids = new Set()
    for (const apt of todayApts) {
      if (!apt.services || apt.services.length <= 1) {
        if (apt.technicianId === techId) ids.add(apt.id)
      } else {
        apt.services.forEach(svc => {
          if ((svc.technicianId || apt.technicianId) === techId) ids.add(apt.id)
        })
      }
    }
    return ids.size
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
      {/*
        Single scroll container — header row is INSIDE here so horizontal
        scroll naturally carries the tech names with the columns. No JS needed.
        position:sticky on .cal-header-row keeps it pinned to the top.
        position:sticky on .cal-header-gutter / .time-gutter keeps the left
        time column pinned while scrolling horizontally.
      */}
      <div className="cal-scroll-area" ref={scrollRef}>
        <div className="cal-inner">

          {/* ── Sticky header row ── */}
          <div className="cal-header-row">
            <div className="cal-header-gutter" />
            {visibleTechs.map(tech => (
              <div key={tech.id} className="tech-header-cell">
                <div className="tech-avatar" style={{ background: tech.color }}>{tech.initials}</div>
                <span className="tech-name">{tech.name}</span>
                <span className="tech-apt-count">{aptCountForTech(tech.id)} appts</span>
              </div>
            ))}
          </div>

          {/* ── Body grid ── */}
          <div className="cal-body-grid">
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
                  onAppointmentClick={apt => setSelectedApt(apt._originalApt || apt)}
                />
              ))}
            </div>
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
          onCashOut={onCashOut ? apt => { setSelectedApt(null); onCashOut(apt) } : undefined}
          onCheckIn={id => {
            updateAppointment(id, { status: 'checkedin' })
            setSelectedApt(prev => prev ? { ...prev, status: 'checkedin' } : null)
          }}
        />
      )}
    </div>
  )
}
