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
  const top = timeToOffset(appointment.startTime)
  const height = (appointment.duration / 15) * SLOT_HEIGHT

  const bg = techColor + '22'
  const border = techColor

  return (
    <div
      className="apt-block"
      style={{
        top: top + 2,
        height: height - 4,
        background: bg,
        borderLeftColor: border,
        color: '#1e293b',
      }}
      onClick={e => { e.stopPropagation(); onClick(appointment) }}
    >
      <div className="apt-client">{appointment.clientName}</div>
      {height > 40 && (
        <div className="apt-service">{appointment.service}</div>
      )}
      {height > 60 && (
        <div className="apt-time">
          {formatTime(appointment.startTime)} · {appointment.duration}m
        </div>
      )}
    </div>
  )
}
