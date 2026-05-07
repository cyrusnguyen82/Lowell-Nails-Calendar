import dayjs from 'dayjs'
import { useApp } from '../../context/AppContext'

const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

export default function MonthView({ currentDate, onDayClick }) {
  const { appointments, technicians } = useApp()
  const today = dayjs()

  const monthStart  = currentDate.startOf('month')
  const monthEnd    = currentDate.endOf('month')
  const calStart    = monthStart.startOf('week')

  /* Build 6-week grid */
  const weeks = []
  let day = calStart
  for (let w = 0; w < 6; w++) {
    const week = []
    for (let d = 0; d < 7; d++) {
      week.push(day)
      day = day.add(1, 'day')
    }
    weeks.push(week)
  }

  function aptsForDay(d) {
    return appointments.filter(a => a.date === d.format('YYYY-MM-DD'))
  }

  function techColor(techId) {
    return technicians.find(t => t.id === techId)?.color ?? '#94a3b8'
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', background:'#f8fafc' }}>
      {/* DOW header */}
      <div style={{
        display:'grid', gridTemplateColumns:'repeat(7,1fr)',
        background:'#0f172a', borderBottom:'1px solid #1e293b',
        flexShrink:0,
      }}>
        {DOW.map(d => (
          <div key={d} style={{
            padding:'10px 0', textAlign:'center',
            fontSize:12, fontWeight:700,
            color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em',
          }}>{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ flex:1, overflow:'auto' }}>
        <div style={{
          display:'grid', gridTemplateColumns:'repeat(7,1fr)',
          gridTemplateRows:`repeat(${weeks.length}, 1fr)`,
          height:`${weeks.length * 130}px`,
          minHeight:'100%',
        }}>
          {weeks.flat().map((d, i) => {
            const isCurrentMonth = d.month() === currentDate.month()
            const isToday = d.isSame(today, 'day')
            const dayApts = aptsForDay(d)
            const extra = dayApts.length - 3

            return (
              <div
                key={i}
                onClick={() => onDayClick(d)}
                style={{
                  border:'1px solid #e2e8f0',
                  borderTop: i < 7 ? '1px solid #e2e8f0' : undefined,
                  padding:'6px 8px',
                  background: isToday ? '#eef2ff' : '#fff',
                  cursor:'pointer',
                  overflow:'hidden',
                  transition:'background 0.1s',
                }}
                onMouseEnter={e => { if (!isToday) e.currentTarget.style.background = '#f8fafc' }}
                onMouseLeave={e => { if (!isToday) e.currentTarget.style.background = '#fff' }}
              >
                {/* Date number */}
                <div style={{
                  width:26, height:26, borderRadius:'50%',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:13, fontWeight: isToday ? 700 : 500,
                  color: isToday ? '#fff' : isCurrentMonth ? '#1e293b' : '#cbd5e1',
                  background: isToday ? '#4f46e5' : 'transparent',
                  marginBottom:4,
                }}>
                  {d.format('D')}
                </div>

                {/* Appointment pills */}
                {dayApts.slice(0, 3).map(apt => (
                  <div
                    key={apt.id}
                    onClick={e => e.stopPropagation()}
                    style={{
                      background: techColor(apt.technicianId) + '33',
                      borderLeft:`3px solid ${techColor(apt.technicianId)}`,
                      borderRadius:3,
                      padding:'1px 5px',
                      fontSize:10,
                      fontWeight:600,
                      color:'#1e293b',
                      marginBottom:2,
                      whiteSpace:'nowrap',
                      overflow:'hidden',
                      textOverflow:'ellipsis',
                    }}
                  >
                    {apt.startTime.replace(/^0/,'')} {apt.clientName}
                  </div>
                ))}

                {extra > 0 && (
                  <div style={{ fontSize:10, color:'#64748b', fontWeight:600 }}>
                    +{extra} more
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
