import { useState, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import './Admin.css'
import '../Calendar/Calendar.css'

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
            <span style={{ color:'#94a3b8', width:72, flexShrink:0, fontWeight:600 }}>{label}</span>
            <span style={{ color:'#334155', wordBreak:'break-word' }}>{val}</span>
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
function CompanySettings() {
  const { companyInfo, updateCompanyInfo } = useApp()
  const [form, setForm] = useState({ ...companyInfo })
  const [saved, setSaved] = useState(false)
  const [logoErr, setLogoErr] = useState(false)
  const fileRef = useRef(null)
  const set = (k,v) => { setForm(f => ({ ...f, [k]: v })); setSaved(false) }

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
        {saved && <span style={{ fontSize:13, color:'#10b981', fontWeight:600 }}>✓ Saved successfully</span>}
      </div>
    </div>
  )
}

/* ── Page ─────────────────────────────────────────────────── */
export default function AdminPage() {
  const { user, users, addUser, updateUser, deleteUser, technicians, addTechnician, updateTechnician, deleteTechnician } = useApp()

  const [tab, setTab]             = useState('technicians')
  const [techModal, setTechModal] = useState(null)   // null | 'new' | tech object
  const [addingStaff, setAddingStaff] = useState(false)
  const [editingUser, setEditingUser] = useState(null)

  if (user.role !== 'admin') {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:12, color:'#94a3b8' }}>
        <span style={{ fontSize:48 }}>🔒</span>
        <p style={{ fontSize:16, fontWeight:600 }}>Admin access required</p>
      </div>
    )
  }

  const TABS = [
    ['technicians', 'Technicians'],
    ['staff',       'Staff Accounts'],
    ['company',     'Company Settings'],
  ]

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
            <div style={{ background:'#fff', borderRadius:12, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
              {users.map((u, i) => (
                <div key={u.id} style={{
                  display:'flex', alignItems:'center', gap:14, padding:'14px 20px',
                  borderBottom: i < users.length-1 ? '1px solid #f1f5f9' : 'none',
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
