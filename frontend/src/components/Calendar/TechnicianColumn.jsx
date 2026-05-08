import AppointmentBlock from './AppointmentBlock'

const START_HOUR = 8
const END_HOUR = 21
const SLOT_HEIGHT = 30

function slotToTime(slotIndex) {
  const totalMinutes = START_HOUR * 60 + slotIndex * 15
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export default function TechnicianColumn({ technician, appointments, onSlotClick, onAppointmentClick }) {
  const totalSlots = (END_HOUR - START_HOUR) * 4

  return (
    <div className="tech-col">
      <div className="time-slots">
        {Array.from({ length: totalSlots }, (_, i) => (
          <div
            key={i}
            className="slot"
            onClick={() => onSlotClick(slotToTime(i))}
          />
        ))}
      </div>

      {appointments.map(apt => (
        <AppointmentBlock
          key={apt.id}
          appointment={apt}
          techColor={technician.color}
          onClick={onAppointmentClick}
        />
      ))}
    </div>
  )
}
