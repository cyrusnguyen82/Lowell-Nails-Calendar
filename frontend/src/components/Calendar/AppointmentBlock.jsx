const SLOT_HEIGHT = 30
const START_HOUR  = 8

function timeToOffset(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  return ((h - START_HOUR) * 60 + m) / 15 * SLOT_HEIGHT
}

function formatTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${hour}:${String(m).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`
}

export default function AppointmentBlock({ appointment, techColor, onClick }) {
  const top    = timeToOffset(appointment.startTime)
  const height = (appointment.duration / 15) * SLOT_HEIGHT
  const isIn   = appointment.status === 'checkedin'
  const isReq  = appointment.techRequested
  const isConf = appointment.clientConfirmed && !isIn

  let bg, border
  if (isIn) {
    bg     = 'rgba(16,185,129,0.15)'
    border = '#10b981'
  } else if (isReq && isConf) {
    bg     = `linear-gradient(to bottom, rgba(30,64,175,0.22) 50%, rgba(239,68,68,0.09) 50%)`
    border = '#ef4444'
  } else if (isReq) {
    bg     = 'rgba(239,68,68,0.09)'
    border = '#ef4444'
  } else if (isConf) {
    bg     = `linear-gradient(to bottom, rgba(30,64,175,0.22) 50%, ${techColor}22 50%)`
    border = techColor
  } else {
    bg     = techColor + '22'
    border = techColor
  }

  const serviceLabel = appointment.services?.length > 1
    ? appointment.services.map(s => s.name).join(' · ')
    : appointment.service

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
      {isReq && !isIn && (
        <div style={{ position:'absolute', top:3, right:4, fontSize:9, fontWeight:800, color:'#ef4444' }}>★</div>
      )}
      <div className="apt-client">{appointment.clientName}</div>
      {height > 44 && <div className="apt-service">{serviceLabel}</div>}
      {height > 64 && (
        <div className="apt-time">{formatTime(appointment.startTime)} · {appointment.duration}m</div>
      )}
    </div>
  )
}
