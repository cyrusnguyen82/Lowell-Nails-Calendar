import { useState, useRef } from 'react'
import XLSX from 'xlsx'
import { useApp } from '../../context/AppContext'
import { SERVICES } from '../../data/mockData'
import './Clients.css'
import '../Calendar/Calendar.css'

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQuotes = !inQuotes }
    else if (line[i] === ',' && !inQuotes) { result.push(current.trim()); current = '' }
    else { current += line[i] }
  }
  result.push(current.trim())
  return result
}

// Normalize a header string to lowercase letters/digits only for flexible matching
function norm(s) { return s.toLowerCase().replace(/[^a-z0-9]/g, '') }

// Find the value for a canonical field by checking multiple possible header names
function pick(row, ...aliases) {
  for (const a of aliases) {
    const key = Object.keys(row).find(k => norm(k) === norm(a))
    if (key && row[key]) return row[key].trim()
  }
  return ''
}

const MODAL_TABS = ['Info', 'Service History']

function formatPhone(raw) {
  const d = raw.replace(/\D/g, '').slice(0, 10)
  if (d.length < 4) return d
  if (d.length < 7) return `(${d.slice(0,3)}) ${d.slice(3)}`
  return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`
}

/* ── Service history entry form ─────────────────────────── */
function AddServiceForm({ clientId, technicians, onSave, onCancel }) {
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], service: SERVICES[0].name, technicianId: technicians[0]?.id, amount: String(SERVICES[0].price), notes: '' })
  const set = (k,v) => setForm(f => ({ ...f, [k]: v }))
  function handleServiceChange(e) {
    const svc = SERVICES.find(s => s.name === e.target.value)
    setForm(f => ({ ...f, service: e.target.value, amount: svc ? String(svc.price) : f.amount }))
  }
  return (
    <div style={{ background:'#f8fafc', borderRadius:8, padding:14, display:'flex', flexDirection:'column', gap:10, marginBottom:12 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <div className="form-group">
          <label className="form-label">Date</label>
          <input className="form-input" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Amount ($)</label>
          <input className="form-input" type="number" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" />
        </div>
        <div className="form-group" style={{ gridColumn:'1/-1' }}>
          <label className="form-label">Service</label>
          <select className="form-select" value={form.service} onChange={handleServiceChange}>
            {!SERVICES.some(s => s.name === form.service) && form.service && (
              <option value={form.service}>{form.service}</option>
            )}
            {SERVICES.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ gridColumn:'1/-1' }}>
          <label className="form-label">Technician</label>
          <select className="form-select" value={form.technicianId} onChange={e => set('technicianId', Number(e.target.value))}>
            {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" style={{ fontSize:12 }} onClick={() => {
          if (!form.date || !form.amount) return
          onSave({ ...form, amount: parseFloat(form.amount) })
        }}>Add Entry</button>
      </div>
    </div>
  )
}

/* ── Client detail modal ─────────────────────────────────── */
function ClientModal({ client, canEdit, technicians, onClose, onSave, onDelete, onAddService, onDeleteService }) {
  const isNew = !client
  const [tab, setTab]           = useState('Info')
  const [form, setForm]         = useState(client || { firstName:'', lastName:'', phone:'', email:'', notes:'', serviceHistory:[] })
  const [addingService, setAddingService] = useState(false)
  const set = (k,v) => setForm(f => ({ ...f, [k]: v }))

  const history = (client?.serviceHistory || []).slice().sort((a,b) => b.date.localeCompare(a.date))
  const totalSpent = history.reduce((s, h) => s + (h.amount || 0), 0)

  function techName(id) { return technicians.find(t => t.id === id)?.name ?? '—' }
  function techColor(id) { return technicians.find(t => t.id === id)?.color ?? '#94a3b8' }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width:520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{isNew ? 'New Client' : `${form.firstName || ''} ${form.lastName || ''}`.trim() || 'Client'}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* Tabs (only for existing clients) */}
        {!isNew && (
          <div style={{ display:'flex', gap:2, padding:'0 20px', background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
            {MODAL_TABS.map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding:'10px 16px', border:'none', background:'none', cursor:'pointer',
                  fontSize:13, fontWeight:600, fontFamily:'inherit',
                  color: tab===t ? '#4f46e5' : '#94a3b8',
                  borderBottom: tab===t ? '2px solid #4f46e5' : '2px solid transparent',
                  marginBottom:-1,
                }}
              >{t}</button>
            ))}
          </div>
        )}

        {/* Info tab */}
        {(isNew || tab === 'Info') && (
          <div className="modal-body">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div className="form-group">
                <label className="form-label">First Name *</label>
                <input className="form-input" value={form.firstName || ''} onChange={e => set('firstName', e.target.value)} disabled={!canEdit} placeholder="First name" autoFocus={isNew} />
              </div>
              <div className="form-group">
                <label className="form-label">Last Name</label>
                <input className="form-input" value={form.lastName || ''} onChange={e => set('lastName', e.target.value)} disabled={!canEdit} placeholder="Last name" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" type="tel" value={form.phone || ''} onChange={e => set('phone', formatPhone(e.target.value))} disabled={!canEdit} placeholder="(616) 555-0100" />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} disabled={!canEdit} placeholder="email@example.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-textarea" value={form.notes || ''} onChange={e => set('notes', e.target.value)} disabled={!canEdit} />
            </div>
          </div>
        )}

        {/* Service History tab */}
        {!isNew && tab === 'Service History' && (
          <div className="modal-body" style={{ maxHeight:420, overflowY:'auto' }}>
            {/* Summary */}
            <div style={{ display:'flex', gap:16, marginBottom:14 }}>
              <div style={{ flex:1, background:'#f8fafc', borderRadius:8, padding:'10px 14px', textAlign:'center' }}>
                <div style={{ fontSize:22, fontWeight:800, color:'#4f46e5' }}>{history.length}</div>
                <div style={{ fontSize:11, color:'#94a3b8', fontWeight:600 }}>Total Visits</div>
              </div>
              <div style={{ flex:1, background:'#f8fafc', borderRadius:8, padding:'10px 14px', textAlign:'center' }}>
                <div style={{ fontSize:22, fontWeight:800, color:'#10b981' }}>${totalSpent.toFixed(2)}</div>
                <div style={{ fontSize:11, color:'#94a3b8', fontWeight:600 }}>Total Spent</div>
              </div>
              <div style={{ flex:1, background:'#f8fafc', borderRadius:8, padding:'10px 14px', textAlign:'center' }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#1e293b' }}>{history[0]?.date ?? '—'}</div>
                <div style={{ fontSize:11, color:'#94a3b8', fontWeight:600 }}>Last Visit</div>
              </div>
            </div>

            {canEdit && !addingService && (
              <button className="btn btn-primary" style={{ fontSize:12, marginBottom:12 }} onClick={() => setAddingService(true)}>
                + Add Service Entry
              </button>
            )}

            {addingService && (
              <AddServiceForm
                clientId={client.id}
                technicians={technicians}
                onSave={entry => { onAddService(client.id, entry); setAddingService(false) }}
                onCancel={() => setAddingService(false)}
              />
            )}

            {/* History list */}
            {history.length === 0 && (
              <p style={{ color:'#94a3b8', fontSize:13, textAlign:'center', padding:'20px 0' }}>No service history yet.</p>
            )}
            {history.map(h => (
              <div key={h.id} style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'10px 12px', borderRadius:8, marginBottom:6,
                background:'#f8fafc', border:'1px solid #e2e8f0',
              }}>
                <div style={{ width:4, alignSelf:'stretch', borderRadius:2, background: techColor(h.technicianId), flexShrink:0 }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>{h.service}</div>
                  <div style={{ fontSize:11, color:'#94a3b8' }}>{h.date} · {techName(h.technicianId)}</div>
                </div>
                <div style={{ fontSize:14, fontWeight:700, color:'#10b981' }}>${(h.amount||0).toFixed(2)}</div>
                {canEdit && (
                  <button onClick={() => onDeleteService(client.id, h.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:16, padding:'0 4px' }}>×</button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="modal-footer">
          {!isNew && canEdit && (
            <button className="btn btn-danger" onClick={() => onDelete(client.id)}>Delete Client</button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          {canEdit && tab === 'Info' && (
            <button className="btn btn-primary" onClick={() => { if ((form.firstName || '').trim()) onSave(form) }}>
              {isNew ? 'Add Client' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Page ────────────────────────────────────────────────── */
export default function ClientsPage() {
  const { user, clients, addClient, updateClient, deleteClient, addServiceEntry, deleteServiceEntry, technicians } = useApp()
  const [search, setSearch]     = useState('')
  const [selected, setSelected] = useState(null)
  const [sortKey, setSortKey]   = useState('name')
  const [sortAsc, setSortAsc]   = useState(true)
  const [importMsg, setImportMsg] = useState('')
  const importRef = useRef(null)

  function importRows(rows) {
    if (rows.length < 2) { setImportMsg('No data rows found.'); return }
    const headers = rows[0].map(h => String(h ?? '').replace(/^"|"$/g, ''))
    let imported = 0
    rows.slice(1).forEach(vals => {
      const row = Object.fromEntries(headers.map((h, i) => [h, String(vals[i] ?? '').replace(/^"|"$/g, '').trim()]))
      const fullName = pick(row, 'name','fullname','clientname','full name','client name','client')
      const firstName = pick(row, 'firstname','first name','first','fname','givenname') ||
                        (fullName ? fullName.split(' ')[0] : '')
      const lastName  = pick(row, 'lastname','last name','last','lname','surname','familyname') ||
                        (fullName ? fullName.split(' ').slice(1).join(' ') : '')
      if (!firstName) return
      addClient({
        firstName, lastName,
        phone: formatPhone(pick(row, 'phone','phonenumber','telephone','tel','mobile','cell','phone number')),
        email: pick(row, 'email','emailaddress','mail','e-mail','email address'),
        notes: pick(row, 'notes','note','comments','comment','memo','description'),
        serviceHistory: [],
      })
      imported++
    })
    setImportMsg(`Imported ${imported} client${imported !== 1 ? 's' : ''}.`)
    setTimeout(() => setImportMsg(''), 3500)
  }

  function handleImportCSV(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    const reader = new FileReader()

    if (ext === 'xlsx' || ext === 'xls') {
      reader.onload = ev => {
        const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        importRows(rows)
      }
      reader.readAsArrayBuffer(file)
    } else {
      reader.onload = ev => {
        const lines = ev.target.result.split('\n').map(l => l.trim()).filter(Boolean)
        const rows = lines.map(line => parseCSVLine(line))
        importRows(rows)
      }
      reader.readAsText(file)
    }
    e.target.value = ''
  }

  const canEdit = user.role === 'admin' || user.role === 'receptionist'

  const filtered = clients
    .filter(c => {
      const q = search.toLowerCase()
      return (c.name || '').toLowerCase().includes(q) ||
        (c.firstName || '').toLowerCase().includes(q) ||
        (c.lastName  || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(search) ||
        (c.email || '').toLowerCase().includes(q)
    })
    .sort((a, b) => {
      let va = a[sortKey] ?? '', vb = b[sortKey] ?? ''
      if (typeof va === 'string') va = va.toLowerCase()
      if (typeof vb === 'string') vb = vb.toLowerCase()
      return sortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1)
    })

  function toggleSort(key) {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(true) }
  }

  function SortTh({ label, field }) {
    const active = sortKey === field
    return (
      <th className={`clients-th sortable${active?' active':''}`} onClick={() => toggleSort(field)}>
        {label} {active ? (sortAsc ? '↑' : '↓') : ''}
      </th>
    )
  }

  function handleSave(form) {
    const payload = { ...form, phone: formatPhone(form.phone || '') }
    if (selected === 'new') addClient({ ...payload, serviceHistory: [] })
    else updateClient(selected.id, payload)
    setSelected(null)
  }

  /* Re-select updated client from state so tabs refresh */
  function getSelected() {
    if (selected === 'new' || selected === null) return selected
    return clients.find(c => c.id === selected.id) ?? selected
  }

  return (
    <div className="clients-page">
      <div className="clients-toolbar">
        <h2 className="clients-title">Clients</h2>
        <input className="clients-search" placeholder="Search by name, phone, or email..." value={search} onChange={e => setSearch(e.target.value)} />
        {canEdit && (
          <>
            <button className="btn btn-ghost" style={{ fontSize:13 }} onClick={() => importRef.current?.click()}>
              Import CSV
            </button>
            <input ref={importRef} type="file" accept=".csv,.xlsx,.xls,text/csv" style={{ display:'none' }} onChange={handleImportCSV} />
            <button className="btn btn-primary" onClick={() => setSelected('new')}>+ New Client</button>
          </>
        )}
      </div>
      {importMsg && (
        <div style={{ padding:'6px 24px', fontSize:13, color:'#16a34a', fontWeight:600 }}>{importMsg}</div>
      )}

      <div className="clients-table-wrap">
        <table className="clients-table">
          <thead>
            <tr>
              <SortTh label="Name"         field="name" />
              <SortTh label="Phone"        field="phone" />
              <SortTh label="Email"        field="email" />
              <SortTh label="Last Visit"   field="lastVisit" />
              <SortTh label="Visits"       field="totalVisits" />
              <th className="clients-th">Total Spent</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const total = (c.serviceHistory || []).reduce((s,h) => s+(h.amount||0), 0)
              return (
                <tr key={c.id} className="clients-row" onClick={() => setSelected(c)}>
                  <td className="clients-td name">{c.name}</td>
                  <td className="clients-td">{c.phone}</td>
                  <td className="clients-td">{c.email}</td>
                  <td className="clients-td">{c.lastVisit}</td>
                  <td className="clients-td center"><span className="visit-badge">{c.totalVisits}</span></td>
                  <td className="clients-td center" style={{ fontWeight:600, color:'#10b981' }}>${total.toFixed(2)}</td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign:'center', padding:40, color:'#94a3b8', fontSize:14 }}>No clients found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected !== null && (
        <ClientModal
          client={selected === 'new' ? null : getSelected()}
          canEdit={canEdit}
          technicians={technicians}
          onClose={() => setSelected(null)}
          onSave={handleSave}
          onDelete={id => { deleteClient(id); setSelected(null) }}
          onAddService={(clientId, entry) => { addServiceEntry(clientId, entry) }}
          onDeleteService={(clientId, entryId) => { deleteServiceEntry(clientId, entryId) }}
        />
      )}
    </div>
  )
}
