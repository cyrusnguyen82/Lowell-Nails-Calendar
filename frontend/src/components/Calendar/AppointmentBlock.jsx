import dayjs from 'dayjs'

const SLOT_HEIGHT = 30
const START_HOUR = 8

function timeToOffset(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  return ((h - START_HOUR) * 60 + m) / 15 * SLOT_HEIGHT
}

function formatTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  const suffix = h >= 12 ? 'pm' : 'am'
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`
}

export default function AppointmentBlock({ appointment, techColor, onClick }) {
  const top    = timeToOffset(appointment.startTime)
  const height = (appointment.duration / 15) * SLOT_HEIGHT
  const isIn   = appointment.status === 'checkedin'

  const bg     = isIn ? 'rgba(16,185,129,0.15)' : techColor + '22'
  const border = isIn ? '#10b981' : techColor

  return (
    <div
      className={`apt-block${isIn ? ' checkedin' : ''}`}
      style={{ top: top + 2, height: height - 4, background: bg, borderLeftColor: border }}
      onClick={e => { e.stopPropagation(); onClick(appointment) }}
    >
      {isIn && (
        <div className="apt-checkedin-badge">
          <span className="apt-checkedin-dot" />
          IN
        </div>
      )}
      <div className="apt-client">{appointment.clientName}</div>
      {height > 44 && <div className="apt-service">{appointment.service}</div>}
      {height > 64 && (
        <div className="apt-time">{formatTime(appointment.startTime)} · {appointment.duration}m</div>
      )}
    </div>
  )
}
