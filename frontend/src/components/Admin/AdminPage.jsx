import { useState, useRef, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import * as api from '../../api'
import GiftCardsPage from '../GiftCards/GiftCardsPage'
import { Lock } from 'lucide-react'
import './Admin.css'
import '../Calendar/Calendar.css'

/* ── PIN Gate ─────────────────────────────────────────────── */
const ADMIN_PIN = '1234'

function PinGate({ onUnlock }) {
  const [digits, setDigits]   = useState([])
  const [shaking, setShaking] = useState(false)
  const [error, setError]     = useState(false)

  function press(d) {
    if (digits.length >= 4 || shaking) return
    const next = [...digits, d]
    setDigits(next)
    if (next.length === 4) {
      if (next.join('') === ADMIN_PIN) {
        onUnlock()
      } else {
        setShaking(true); setError(true)
        setTimeout(() => { setDigits([]); setShaking(false); setError(false) }, 700)
      }
    }
  }

  function back() { if (!shaking) setDigits(d => d.slice(0, -1)) }

  return (
    <div className="admin-pin-gate">
      <div className="admin-pin-card">
        <div className="admin-pin-lock"><Lock size={22} /></div>
        <h2 className="admin-pin-title">Admin Access</h2>
        <p className="admin-pin-subtitle">Enter the admin PIN to continue</p>
        <div className={`admin-pin-dots${shaking ? ' shake' : ''}`}>
          {[0,1,2,3].map(i => (
            <div key={i} className={`admin-pin-dot${digits[i] !== undefined ? ' filled' : ''}`} />
          ))}
        </div>
        {error && <p className="admin-pin-error">Incorrect PIN</p>}
        <div className="admin-pin-pad">
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <button key={n} className="admin-pin-key" onClick={() => press(String(n))}>{n}</button>
          ))}
          <button className="admin-pin-key empty" disabled />
          <button className="admin-pin-key" onClick={() => press('0')}>0</button>
          <button className="admin-pin-key backspace" onClick={back}>⌫</button>
        </div>
      </div>
    </div>
  )
}

/* ── Edit / reset-password modal for an existing user ─────── */
function EditUserModal({ targetUser, technicians, onSave, onClose }) {
  const [name, setName]           = useState(targetUser.name)
  const [newPw, setNewPw]         = useState('')
  const [role, setRole]           = useState(targetUser.role)
  const [techId, setTechId]       = useState(targetUser.technicianId || '')
  const isAdmin = targetUser.role === 'admin'

  function handleSave() {
    if (!name.trim()) return
    const updates = { name: name.trim(), role, initials: initials(name.trim()) }
    if (newPw.trim()) updates.password = newPw.trim()
    if (role === 'technician') updates.technicianId = Number(techId) || null
    else updates.technicianId = null
    onSave(updates)
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ width: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Edit — {targetUser.name}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">New Password</label>
            <input className="form-input" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Leave blank to keep current password" />
          </div>
          {!isAdmin && (
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-select" value={role} onChange={e => setRole(e.target.value)}>
                <option value="receptionist">Receptionist</option>
                <option value="technician">Technician</option>
              </select>
            </div>
          )}
          {role === 'technician' && (
            <div className="form-group">
              <label className="form-label">Linked Technician</label>
              <select className="form-select" value={techId} onChange={e => setTechId(e.target.value)}>
                <option value="">Select technician</option>
                {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save Changes</button>
        </div>
      </div>
    </div>
  )
}

const COLORS = ['#7C3AED','#0EA5E9','#10B981','#F59E0B','#EF4444','#EC4899','#8B5CF6','#14B8A6','#F97316','#6366F1']
const ROLE_COLOR = { admin:'#4f46e5', receptionist:'#0ea5e9', technician:'#10b981' }

function initials(name) {
  return name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

/* ── Tech form (shared by add + edit modal) ───────────────── */
function TechForm({ tech, onSave, onCancel }) {
  const blank = { name:'', color: COLORS[0], email:'', phone:'', address:'', dateHired:'' }
  const [form, setForm] = useState(tech ? { ...tech } : blank)
  const set = (k,v) => setForm(f => ({ ...f, [k]: v }))

  const fields = [
    { key:'email',     label:'Email',      type:'email', placeholder:'sarah@bookcal.com',           col:'full' },
    { key:'phone',     label:'Phone',      type:'tel',   placeholder:'555-1000',                    col:'half' },
    { key:'dateHired', label:'Date Hired', type:'date',  placeholder:'',                            col:'half' },
    { key:'address',   label:'Address',    type:'text',  placeholder:'123 Main St, City ST 00000',  col:'full' },
  ]

  return (
    <div className="tech-form">
      <div className="form-group">
        <label className="form-label">Full Name *</label>
        <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Sophie B." autoFocus />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        {fields.map(f => (
          <div key={f.key} className="form-group" style={f.col==='full' ? { gridColumn:'1/-1' } : {}}>
            <label className="form-label">{f.label}</label>
            <input className="form-input" type={f.type} value={form[f.key] || ''} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} />
          </div>
        ))}
      </div>

      <div className="form-group">
        <label className="form-label">Calendar Color</label>
        <div className="color-swatches">
          {COLORS.map(c => (
            <div key={c} className={`color-swatch${form.color===c?' selected':''}`} style={{ background:c }} onClick={() => set('color', c)} />
          ))}
        </div>
      </div>

      {form.name && (
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'4px 0' }}>
          <div className="tech-avatar" style={{ background: form.color }}>{initials(form.name)}</div>
          <span style={{ fontSize:14, fontWeight:600 }}>{form.name}</span>
        </div>
      )}

      <div style={{ display:'flex', gap:8, marginTop:4 }}>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={() => form.name.trim() && onSave({ ...form, initials: initials(form.name) })}>
          {tech ? 'Save Changes' : 'Add Technician'}
        </button>
      </div>
    </div>
  )
}

/* ── Tech edit / add MODAL popup ──────────────────────────── */
function TechModal({ tech, onSave, onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ width:520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          {tech && <div className="modal-header-dot" style={{ background: tech.color }} />}
          <div className="modal-title">{tech ? `Edit — ${tech.name}` : 'New Technician'}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <TechForm tech={tech} onSave={onSave} onCancel={onClose} />
        </div>
      </div>
    </div>
  )
}

/* ── Technician card (read-only) ──────────────────────────── */
function TechCard({ tech, onEdit, onDelete }) {
  const rows = [
    ['Email',      tech.email     || '—'],
    ['Phone',      tech.phone     || '—'],
    ['Address',    tech.address   || '—'],
    ['Date Hired', tech.dateHired || '—'],
  ]
  return (
    <div className="admin-card tech-card">
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
        <div className="tech-avatar" style={{ background: tech.color, width:46, height:46, fontSize:15 }}>{tech.initials}</div>
        <div>
          <div style={{ fontWeight:700, fontSize:16 }}>{tech.name}</div>
          <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:3 }}>
            <span style={{ width:10, height:10, borderRadius:'50%', background:tech.color, display:'inline-block' }}/>
            <span style={{ fontSize:11, color:'#94a3b8' }}>{tech.color}</span>
          </div>
        </div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:14 }}>
        {rows.map(([label, val]) => (
          <div key={label} style={{ display:'flex', gap:8, fontSize:12 }}>
            <span style={{ color:'var(--pos-muted)', width:72, flexShrink:0, fontWeight:600 }}>{label}</span>
            <span style={{ color:'var(--pos-text)', wordBreak:'break-word' }}>{val}</span>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <button className="btn btn-ghost"  style={{ fontSize:12, padding:'5px 12px' }} onClick={onEdit}>Edit</button>
        <button className="btn btn-danger" style={{ fontSize:12, padding:'5px 12px' }} onClick={onDelete}>Remove</button>
      </div>
    </div>
  )
}

/* ── New staff account form ───────────────────────────────── */
function NewStaffForm({ technicians, onSave, onCancel }) {
  const [form, setForm] = useState({ name:'', username:'', password:'', role:'receptionist', technicianId:'' })
  const set = (k,v) => setForm(f => ({ ...f, [k]: v }))
  function handleSave() {
    if (!form.name.trim() || !form.username.trim() || !form.password.trim()) return
    const entry = { ...form, initials: initials(form.name) }
    if (form.role === 'technician') entry.technicianId = Number(form.technicianId)
    onSave(entry)
  }
  return (
    <div className="admin-card" style={{ marginBottom:16 }}>
      <h3 style={{ marginBottom:14, fontSize:14, fontWeight:700 }}>New Staff Account</h3>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <div className="form-group" style={{ gridColumn:'1/-1' }}>
          <label className="form-label">Full Name *</label>
          <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Jane Smith" autoFocus />
        </div>
        <div className="form-group">
          <label className="form-label">Username *</label>
          <input className="form-input" value={form.username} onChange={e => set('username', e.target.value)} placeholder="jsmith" />
        </div>
        <div className="form-group">
          <label className="form-label">Password *</label>
          <input className="form-input" type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="••••••••" />
        </div>
        <div className="form-group">
          <label className="form-label">Role</label>
          <select className="form-select" value={form.role} onChange={e => set('role', e.target.value)}>
            <option value="receptionist">Receptionist</option>
            <option value="technician">Technician</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        {form.role === 'technician' && (
          <div className="form-group">
            <label className="form-label">Linked Technician</label>
            <select className="form-select" value={form.technicianId} onChange={e => set('technicianId', e.target.value)}>
              <option value="">Select technician</option>
              {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}
      </div>
      <div style={{ display:'flex', gap:8, marginTop:12 }}>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave}>Create Account</button>
      </div>
    </div>
  )
}

/* ── Company Settings tab ─────────────────────────────────── */
const THEMES = [
  { id: 'carbon', label: 'Carbon', desc: 'Anthracite + emerald — crisp & modern', dot: '#10b981', bg: '#0f1117' },
  { id: 'cobalt', label: 'Cobalt', desc: 'Deep navy + electric blue — bold',      dot: '#60a5fa', bg: '#05112a' },
  { id: 'ember',  label: 'Ember',  desc: 'Warm charcoal + amber glow — premium',  dot: '#fb923c', bg: '#110d0a' },
  { id: 'cloud',  label: 'Cloud',  desc: 'Clean white + indigo — light & airy',   dot: '#6366f1', bg: '#f4f7fc' },
]

function CompanySettings() {
  const { companyInfo, updateCompanyInfo } = useApp()
  const [form, setForm] = useState({ ...companyInfo })
  const [saved, setSaved] = useState(false)
  const [logoErr, setLogoErr] = useState(false)
  const fileRef = useRef(null)
  const set = (k,v) => { setForm(f => ({ ...f, [k]: v })); setSaved(false) }

  const [activeTheme, setActiveTheme] = useState(() => {
    try { return localStorage.getItem('lowell_theme') || 'carbon' } catch { return 'carbon' }
  })
  function applyTheme(id) {
    setActiveTheme(id)
    try { localStorage.setItem('lowell_theme', id) } catch {}
    document.documentElement.setAttribute('data-theme', id)
  }

  function handleLogoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { set('logoUrl', ev.target.result); setLogoErr(false) }
    reader.readAsDataURL(file)
  }

  function handleSave() {
    updateCompanyInfo(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const fields = [
    { key:'name',    label:'Company Name *', type:'text',  col:'full', placeholder:'Lowell Nails and Spa, LLC' },
    { key:'address', label:'Street Address', type:'text',  col:'full', placeholder:'505 W. Main St. Suite B' },
    { key:'city',    label:'City, State ZIP', type:'text', col:'half', placeholder:'Lowell, MI 49331' },
    { key:'phone',   label:'Phone',          type:'tel',  col:'half', placeholder:'(616) 319-7924' },
    { key:'email',   label:'Email',          type:'email',col:'half', placeholder:'info@lowellnails.com' },
    { key:'website', label:'Website',        type:'url',  col:'half', placeholder:'https://lowellnails.com' },
  ]

  return (
    <div>
      <div className="panel-header" style={{ marginBottom:20 }}>
        <span>Business details displayed on the login screen and app header</span>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        {/* Left: fields */}
        <div style={{ gridColumn:'1/-1', display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          {fields.map(f => (
            <div key={f.key} className="form-group" style={f.col==='full' ? { gridColumn:'1/-1' } : {}}>
              <label className="form-label">{f.label}</label>
              <input className="form-input" type={f.type} value={form[f.key] || ''} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} />
            </div>
          ))}
        </div>

        {/* Logo section */}
        <div className="admin-card" style={{ gridColumn:'1/-1' }}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>Logo</div>
          <div style={{ display:'flex', alignItems:'center', gap:20, flexWrap:'wrap' }}>
            {/* Preview */}
            <div style={{ width:120, height:120, background:'#0f172a', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0 }}>
              {form.logoUrl && !logoErr ? (
                <img src={form.logoUrl} alt="Logo preview" style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain' }} onError={() => setLogoErr(true)} />
              ) : (
                <div style={{ color:'#64748b', fontSize:12, textAlign:'center', padding:8 }}>No logo</div>
              )}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div>
                <button className="btn btn-primary" style={{ fontSize:13 }} onClick={() => fileRef.current?.click()}>
                  Upload Logo Image
                </button>
                <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleLogoUpload} />
              </div>
              <div style={{ fontSize:12, color:'#64748b' }}>
                PNG or JPG recommended. Displays in sidebar and login screen.<br />
                Or place your file at <code style={{ fontSize:11, background:'#f1f5f9', padding:'1px 6px', borderRadius:4 }}>frontend/public/logo.png</code>
              </div>
              <div className="form-group" style={{ margin:0 }}>
                <label className="form-label">Logo URL / path</label>
                <input className="form-input" style={{ fontSize:12 }} value={form.logoUrl || ''} onChange={e => { set('logoUrl', e.target.value); setLogoErr(false) }} placeholder="/logo.png" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop:20, display:'flex', alignItems:'center', gap:12 }}>
        <button className="btn btn-primary" onClick={handleSave}>Save Company Info</button>
        {saved && <span style={{ fontSize:13, color:'var(--pos-teal)', fontWeight:600 }}>✓ Saved successfully</span>}
      </div>

      {/* ── Theme Picker ── */}
      <div className="admin-card" style={{ marginTop:24 }}>
        <div style={{ fontWeight:700, fontSize:14, marginBottom:4, color:'var(--pos-text)' }}>Color Theme</div>
        <div style={{ fontSize:12, color:'var(--pos-muted)', marginBottom:16 }}>Choose the look and feel for the entire app.</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:10 }}>
          {THEMES.map(t => (
            <button
              key={t.id}
              onClick={() => applyTheme(t.id)}
              style={{
                display:'flex', flexDirection:'column', gap:8,
                padding:'14px', borderRadius:10, cursor:'pointer', textAlign:'left',
                border: activeTheme === t.id ? `2px solid ${t.dot}` : '2px solid var(--pos-border)',
                background: activeTheme === t.id ? t.dot + '18' : 'var(--pos-sidebar)',
                transition:'border-color 0.15s, background 0.15s',
              }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:32, height:20, borderRadius:5, background:t.bg, border:'1px solid rgba(255,255,255,0.1)', flexShrink:0 }} />
                <div style={{ width:10, height:10, borderRadius:'50%', background:t.dot, flexShrink:0 }} />
              </div>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--pos-text)' }}>{t.label}</div>
              <div style={{ fontSize:11, color:'var(--pos-muted)', lineHeight:1.4 }}>{t.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Default schedule template ─────────────────────────────────
const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
const DAY_LABELS = { monday:'Mon', tuesday:'Tue', wednesday:'Wed', thursday:'Thu', friday:'Fri', saturday:'Sat', sunday:'Sun' }

function defaultSchedule() {
  const sched = {}
  for (const d of DAYS) {
    sched[d] = d === 'sunday'
      ? { working: false, start: '09:30', end: '19:00' }
      : { working: true,  start: '09:30', end: '19:00' }
  }
  return sched
}

/* ── Availability panel ────────────────────────────────────── */
function AvailabilityPanel({ technicians, updateTechnician }) {
  const [selectedTechId, setSelectedTechId] = useState(technicians[0]?.id || null)
  const [saving, setSaving]   = useState(false)
  const [saved,  setSaved]    = useState(false)
  const [error,  setError]    = useState('')

  const tech = technicians.find(t => t.id === selectedTechId)
  const [schedule, setSchedule] = useState(() => {
    return tech?.workSchedule ? { ...defaultSchedule(), ...tech.workSchedule } : defaultSchedule()
  })

  function selectTech(id) {
    setSelectedTechId(id)
    const t = technicians.find(x => x.id === id)
    setSchedule(t?.workSchedule ? { ...defaultSchedule(), ...t.workSchedule } : defaultSchedule())
    setSaved(false)
    setError('')
  }

  function setDay(day, field, value) {
    setSchedule(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }))
    setSaved(false)
  }

  async function handleSave() {
    if (!selectedTechId) return
    setSaving(true)
    setError('')
    try {
      const saved = await api.put(`/technicians/${selectedTechId}/schedule`, { workSchedule: schedule })
      updateTechnician(selectedTechId, { workSchedule: schedule })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!technicians.length) return (
    <div style={{ padding: 32, color: '#94a3b8', textAlign: 'center' }}>No technicians yet — add one in the Technicians tab first.</div>
  )

  return (
    <div>
      <div className="panel-header" style={{ marginBottom: 20 }}>
        <span>Set each technician's weekly working hours. Michael uses these for availability checks.</span>
      </div>

      {/* Tech selector row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {technicians.map(t => (
          <button
            key={t.id}
            onClick={() => selectTech(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
              border: selectedTechId === t.id ? `2px solid ${t.color}` : '2px solid var(--pos-border)',
              background: selectedTechId === t.id ? t.color + '22' : 'var(--pos-card)',
              fontWeight: selectedTechId === t.id ? 700 : 500,
              fontSize: 13, color: 'var(--pos-text)',
            }}
          >
            <div className="tech-avatar" style={{ background: t.color, width: 28, height: 28, fontSize: 10 }}>{t.initials}</div>
            {t.name}
          </button>
        ))}
      </div>

      {tech && (
        <div className="admin-card" style={{ maxWidth: 560 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="tech-avatar" style={{ background: tech.color, width: 32, height: 32, fontSize: 11 }}>{tech.initials}</div>
            {tech.name}'s Weekly Schedule
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {DAYS.map(day => {
              const dayData = schedule[day] || { working: false, start: '09:30', end: '19:00' }
              return (
                <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Working toggle */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={dayData.working}
                      onChange={e => setDay(day, 'working', e.target.checked)}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                    <span style={{ width: 32, fontSize: 13, fontWeight: 600, color: dayData.working ? 'var(--pos-text)' : 'var(--pos-muted)' }}>
                      {DAY_LABELS[day]}
                    </span>
                  </label>

                  {dayData.working ? (
                    <>
                      <input
                        type="time"
                        value={dayData.start}
                        onChange={e => setDay(day, 'start', e.target.value)}
                        className="form-input"
                        style={{ width: 110, padding: '5px 8px', fontSize: 13 }}
                      />
                      <span style={{ fontSize: 13, color: '#94a3b8' }}>to</span>
                      <input
                        type="time"
                        value={dayData.end}
                        onChange={e => setDay(day, 'end', e.target.value)}
                        className="form-input"
                        style={{ width: 110, padding: '5px 8px', fontSize: 13 }}
                      />
                    </>
                  ) : (
                    <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>Day off</span>
                  )}
                </div>
              )
            })}
          </div>

          {error && <div style={{ marginTop: 12, fontSize: 12, color: '#dc2626' }}>{error}</div>}

          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Schedule'}
            </button>
            {saved && <span style={{ fontSize: 13, color: '#10b981', fontWeight: 600 }}>✓ Saved</span>}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Transactions Panel (admin: edit tech; receptionist: view-only) ── */
function TransactionsPanel() {
  const { user, technicians } = useApp()
  const [txns, setTxns]       = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [editingLine, setEditingLine] = useState(null)  // { txnId, lineId }
  const [newTechId, setNewTechId]     = useState(null)
  const [saving, setSaving]           = useState(false)
  const [msg, setMsg]                 = useState('')

  const canEdit = user.role === 'admin'

  useEffect(() => {
    api.get('/pos/transactions')
      .then(data => { setTxns(data.sort((a,b) => b.date.localeCompare(a.date) || b.id - a.id)); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function techName(id)  { return technicians.find(t => t.id === id)?.name  || '—' }
  function techColor(id) { return technicians.find(t => t.id === id)?.color || '#94a3b8' }

  async function saveTech(txnId, lineId) {
    if (!newTechId) return
    setSaving(true)
    try {
      await api.put(`/pos/line-items/${lineId}`, { technicianId: newTechId })
      setTxns(prev => prev.map(t => {
        if (t.id !== txnId) return t
        return { ...t, lineItems: t.lineItems.map(li => li.id === lineId ? { ...li, technicianId: newTechId } : li) }
      }))
      setEditingLine(null)
      setMsg('Tech updated.')
      setTimeout(() => setMsg(''), 2500)
    } catch (err) {
      setMsg('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ padding:32, color:'#94a3b8', textAlign:'center' }}>Loading transactions…</div>

  return (
    <div>
      <div className="panel-header" style={{ marginBottom:16 }}>
        <span>{txns.length} closed ticket{txns.length !== 1 ? 's' : ''}</span>
        {msg && <span style={{ fontSize:13, color:'#10b981', fontWeight:600 }}>{msg}</span>}
      </div>

      {txns.length === 0 && (
        <div style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>No transactions yet.</div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {txns.map(txn => (
          <div key={txn.id} className="admin-card" style={{ padding:0, overflow:'hidden' }}>
            {/* Header row */}
            <div
              style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', cursor:'pointer', background:'var(--pos-card)' }}
              onClick={() => setExpanded(expanded === txn.id ? null : txn.id)}>
              <span style={{ fontSize:12, fontWeight:700, color:'var(--pos-muted)', whiteSpace:'nowrap' }}>#{txn.id}</span>
              <span style={{ flex:1, fontWeight:700, fontSize:14, color:'var(--pos-text)' }}>{txn.clientName || 'Walk-in'}</span>
              <span style={{ fontSize:12, color:'var(--pos-muted)' }}>{txn.date}</span>
              <span style={{ fontSize:11, fontWeight:700, background:'rgba(67,142,142,0.15)', color:'var(--pos-teal)', padding:'2px 8px', borderRadius:8 }}>
                {(txn.paymentMethod || '').toUpperCase()}
              </span>
              <span style={{ fontSize:15, fontWeight:800, color:'var(--pos-gold)' }}>${(txn.total || 0).toFixed(2)}</span>
              <span style={{ fontSize:10, color:'var(--pos-muted)' }}>{expanded === txn.id ? '▲' : '▼'}</span>
            </div>

            {expanded === txn.id && (
              <div style={{ borderTop:'1px solid var(--pos-border)', padding:'10px 16px', background:'var(--pos-sidebar)' }}>
                {/* Line items */}
                {(txn.lineItems || []).map(li => (
                  <div key={li.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 0', borderBottom:'1px dotted var(--pos-border)' }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:techColor(li.technicianId), flexShrink:0 }} />
                    <span style={{ flex:1, fontSize:13, fontWeight:600, color:'var(--pos-text)' }}>{li.service}</span>
                    <span style={{ fontSize:12, color:'var(--pos-muted)', minWidth:80 }}>
                      {editingLine?.lineId === li.id ? (
                        <select
                          className="form-select" style={{ fontSize:12, padding:'2px 6px', height:'auto' }}
                          value={newTechId || li.technicianId}
                          onChange={e => setNewTechId(Number(e.target.value))}>
                          {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      ) : techName(li.technicianId)}
                    </span>
                    <span style={{ fontSize:13, fontWeight:700, minWidth:52, textAlign:'right', color:'var(--pos-gold)' }}>${(li.price || 0).toFixed(2)}</span>
                    {canEdit && (
                      editingLine?.lineId === li.id ? (
                        <div style={{ display:'flex', gap:4 }}>
                          <button className="btn btn-ghost" style={{ fontSize:11, padding:'2px 8px' }}
                            onClick={() => setEditingLine(null)}>Cancel</button>
                          <button className="btn btn-primary" style={{ fontSize:11, padding:'2px 8px' }} disabled={saving}
                            onClick={() => saveTech(txn.id, li.id)}>Save</button>
                        </div>
                      ) : (
                        <button className="btn btn-ghost" style={{ fontSize:11, padding:'2px 8px' }}
                          onClick={() => { setEditingLine({ txnId: txn.id, lineId: li.id }); setNewTechId(li.technicianId) }}>
                          Edit Tech
                        </button>
                      )
                    )}
                  </div>
                ))}
                {/* Totals */}
                <div style={{ display:'flex', gap:16, flexWrap:'wrap', paddingTop:8, fontSize:12, color:'var(--pos-muted)' }}>
                  <span>Subtotal ${(txn.subtotal||0).toFixed(2)}</span>
                  <span>Tax ${(txn.tax||0).toFixed(2)}</span>
                  {txn.tip > 0 && <span>Tip ${(txn.tip||0).toFixed(2)}</span>}
                  {txn.giftCardAmount > 0 && <span style={{color:'#3ab592'}}>Gift Card -${(txn.giftCardAmount||0).toFixed(2)}</span>}
                  <strong>Total ${(txn.total||0).toFixed(2)}</strong>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Page ─────────────────────────────────────────────────── */
export default function AdminPage() {
  const { user, users, addUser, updateUser, deleteUser, technicians, addTechnician, updateTechnician, deleteTechnician } = useApp()

  const isAdmin = user.role === 'admin'

  const [pinUnlocked, setPinUnlocked] = useState(() => {
    try { return isAdmin || sessionStorage.getItem('lowell_admin_unlocked') === '1' }
    catch { return isAdmin }
  })

  function handleUnlock() {
    setPinUnlocked(true)
    try { sessionStorage.setItem('lowell_admin_unlocked', '1') } catch {}
  }

  const [tab, setTab]             = useState('technicians')
  const [techModal, setTechModal] = useState(null)
  const [addingStaff, setAddingStaff] = useState(false)
  const [editingUser, setEditingUser] = useState(null)

  if (user.role !== 'admin' && user.role !== 'receptionist') {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:12, color:'var(--pos-muted)' }}>
        <Lock size={40} color="var(--pos-muted)" />
        <p style={{ fontSize:16, fontWeight:600 }}>Access denied</p>
      </div>
    )
  }

  if (!pinUnlocked) return <PinGate onUnlock={handleUnlock} />

  const ALL_TABS = [
    ['technicians',  'Technicians'    ],
    ['availability', 'Availability'   ],
    ['staff',        'Staff Accounts' ],
    ['company',      'Company'        ],
    ['transactions', 'Transactions'   ],
    ['giftcards',    'Gift Cards'     ],
  ]
  const TABS = ALL_TABS

  return (
    <div className="admin-page">
      <div className="admin-toolbar">
        <h2 className="admin-title">Admin</h2>
        <div className="admin-tabs">
          {TABS.map(([id, label]) => (
            <button key={id} className={`admin-tab${tab===id?' active':''}`}
              onClick={() => { setTab(id); setTechModal(null); setAddingStaff(false) }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="admin-body">

        {/* ── Availability ── */}
        {tab === 'availability' && (
          <AvailabilityPanel technicians={technicians} updateTechnician={updateTechnician} />
        )}

        {/* ── Technicians ── */}
        {tab === 'technicians' && (
          <div className="tech-panel">
            <div className="panel-header">
              <span>{technicians.length} technician{technicians.length !== 1 ? 's' : ''}</span>
              <button className="btn btn-primary" onClick={() => setTechModal('new')}>+ Add Technician</button>
            </div>
            <div className="tech-grid">
              {technicians.map(tech => (
                <TechCard
                  key={tech.id}
                  tech={tech}
                  onEdit={() => setTechModal(tech)}
                  onDelete={() => { if (window.confirm(`Remove ${tech.name}?`)) deleteTechnician(tech.id) }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Staff Accounts ── */}
        {tab === 'staff' && (
          <div>
            <div className="panel-header" style={{ marginBottom:16 }}>
              <span>{users.length} staff account{users.length !== 1 ? 's' : ''}</span>
              {!addingStaff && <button className="btn btn-primary" onClick={() => setAddingStaff(true)}>+ New Account</button>}
            </div>
            {addingStaff && (
              <NewStaffForm
                technicians={technicians}
                onSave={u => { addUser(u); setAddingStaff(false) }}
                onCancel={() => setAddingStaff(false)}
              />
            )}
            <div style={{ background:'var(--pos-card)', borderRadius:12, overflow:'hidden', border:'1px solid var(--pos-border)' }}>
              {users.map((u, i) => (
                <div key={u.id} style={{
                  display:'flex', alignItems:'center', gap:14, padding:'14px 20px',
                  borderBottom: i < users.length-1 ? '1px solid var(--pos-border)' : 'none',
                }}>
                  <div className="tech-avatar" style={{ background: ROLE_COLOR[u.role] ?? '#64748b', width:36, height:36, fontSize:12 }}>{u.initials}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:14 }}>{u.name}</div>
                    <div style={{ fontSize:12, color:'#94a3b8' }}>@{u.username}</div>
                  </div>
                  <span style={{
                    fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:10,
                    background: (ROLE_COLOR[u.role] ?? '#64748b') + '22',
                    color: ROLE_COLOR[u.role] ?? '#64748b',
                  }}>{u.role}</span>
                  <button className="btn btn-ghost" style={{ fontSize:11, padding:'4px 10px' }}
                    onClick={() => setEditingUser(u)}>
                    Edit
                  </button>
                  {u.id !== user.id && (
                    <button className="btn btn-danger" style={{ fontSize:11, padding:'4px 10px' }}
                      onClick={() => { if (window.confirm(`Delete account for ${u.name}?`)) deleteUser(u.id) }}>
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Company Settings ── */}
        {tab === 'company' && <CompanySettings />}

        {/* ── Transactions ── */}
        {tab === 'transactions' && <TransactionsPanel />}

        {/* ── Gift Cards ── */}
        {tab === 'giftcards' && <GiftCardsPage />}
      </div>

      {/* Tech add / edit modal popup */}
      {techModal !== null && (
        <TechModal
          tech={techModal === 'new' ? null : techModal}
          onClose={() => setTechModal(null)}
          onSave={data => {
            if (techModal === 'new') addTechnician(data)
            else updateTechnician(techModal.id, data)
            setTechModal(null)
          }}
        />
      )}

      {/* User edit / password reset modal */}
      {editingUser && (
        <EditUserModal
          targetUser={editingUser}
          technicians={technicians}
          onClose={() => setEditingUser(null)}
          onSave={data => {
            updateUser(editingUser.id, data)
            setEditingUser(null)
          }}
        />
      )}
    </div>
  )
}
