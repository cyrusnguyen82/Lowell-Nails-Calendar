import { useState, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import './GiftCards.css'
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

function norm(s) { return s.toLowerCase().replace(/[^a-z0-9]/g, '') }

function pick(row, ...aliases) {
  for (const a of aliases) {
    const key = Object.keys(row).find(k => norm(k) === norm(a))
    if (key && row[key]) return row[key].trim()
  }
  return ''
}

function gcStatus(gc) {
  if (gc.balance <= 0) return 'redeemed'
  if (gc.expiryDate < new Date().toISOString().split('T')[0]) return 'expired'
  return 'active'
}

const STATUS_STYLE = {
  active:   { bg:'#dcfce7', color:'#16a34a', label:'Active' },
  redeemed: { bg:'#f1f5f9', color:'#94a3b8', label:'Redeemed' },
  expired:  { bg:'#fee2e2', color:'#dc2626', label:'Expired' },
}

function nextCardNumber(giftCards) {
  const year = new Date().getFullYear()
  const nums = giftCards
    .filter(g => g.cardNumber.startsWith(`GC-${year}-`))
    .map(g => parseInt(g.cardNumber.split('-')[2] || '0'))
  const max = nums.length ? Math.max(...nums) : 0
  return `GC-${year}-${String(max + 1).padStart(3,'0')}`
}

/* ── Modal: view / redeem ──────────────────────────────── */
function GCViewModal({ gc, canEdit, onClose, onRedeem, onDelete }) {
  const [amount, setAmount] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const status = gcStatus(gc)
  const s = STATUS_STYLE[status]

  function handleRedeem() {
    const val = parseFloat(amount)
    if (!val || val <= 0 || val > gc.balance) return
    onRedeem(gc.id, val)
    setRedeeming(false)
    setAmount('')
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ fontFamily:'monospace', fontSize:13, fontWeight:700, color:'#4f46e5', background:'#eef2ff', padding:'4px 10px', borderRadius:6 }}>
            {gc.cardNumber}
          </div>
          <div className="modal-title" style={{ flex:1, marginLeft:10 }}>Gift Card</div>
          <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:10, background:s.bg, color:s.color }}>{s.label}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {[
            ['Purchase Date',   gc.purchaseDate],
            ['Purchased By',    gc.purchasedBy],
            ['Recipient',       gc.recipientName || gc.purchasedBy],
            ['Expiry Date',     gc.expiryDate],
            ['Original Amount', `$${gc.amount.toFixed(2)}`],
          ].map(([label, val]) => (
            <div key={label} className="modal-detail-row">
              <span className="modal-detail-label">{label}</span>
              <span className="modal-detail-value">{val}</span>
            </div>
          ))}

          <div style={{
            background: status==='active' ? '#f0fdf4' : '#f8fafc',
            border: `1px solid ${status==='active' ? '#bbf7d0' : '#e2e8f0'}`,
            borderRadius:8, padding:'14px 16px', marginTop:4,
          }}>
            <div style={{ fontSize:11, fontWeight:600, color:'#64748b', marginBottom:4 }}>REMAINING BALANCE</div>
            <div style={{ fontSize:28, fontWeight:800, color: status==='active' ? '#16a34a' : '#94a3b8' }}>
              ${gc.balance.toFixed(2)}
            </div>
          </div>

          {gc.notes && <div className="modal-notes">{gc.notes}</div>}

          {canEdit && status === 'active' && !redeeming && (
            <button className="btn btn-primary" style={{ marginTop:4 }} onClick={() => setRedeeming(true)}>
              Redeem Balance
            </button>
          )}

          {redeeming && (
            <div style={{ display:'flex', gap:8, alignItems:'flex-end', marginTop:4 }}>
              <div className="form-group" style={{ flex:1 }}>
                <label className="form-label">Redeem Amount ($)</label>
                <input className="form-input" type="number" step="0.01" min="0.01" max={gc.balance} value={amount} onChange={e => setAmount(e.target.value)} autoFocus placeholder={`Max $${gc.balance.toFixed(2)}`} />
              </div>
              <button className="btn btn-ghost" onClick={() => setRedeeming(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleRedeem}>Confirm</button>
            </div>
          )}
        </div>
        <div className="modal-footer">
          {canEdit && <button className="btn btn-danger" onClick={() => onDelete(gc.id)}>Delete</button>}
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

/* ── Modal: new gift card ──────────────────────────────── */
function GCNewModal({ nextNumber, onClose, onSave }) {
  const today = new Date().toISOString().split('T')[0]
  const nextYear = `${new Date().getFullYear()+1}-${today.slice(5)}`
  const [form, setForm] = useState({
    cardNumber: nextNumber,
    purchaseDate: today,
    purchasedBy: '',
    recipientName: '',
    expiryDate: nextYear,
    amount: '',
    notes: '',
  })
  const set = (k,v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">New Gift Card</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div className="form-group">
              <label className="form-label">Card Number</label>
              <input className="form-input" value={form.cardNumber} onChange={e => set('cardNumber', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Amount ($) *</label>
              <input className="form-input" type="number" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label className="form-label">Purchased By *</label>
              <input className="form-input" value={form.purchasedBy} onChange={e => set('purchasedBy', e.target.value)} placeholder="Client name" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Recipient Name</label>
              <input className="form-input" value={form.recipientName} onChange={e => set('recipientName', e.target.value)} placeholder="Leave blank if same" />
            </div>
            <div className="form-group">
              <label className="form-label">Purchase Date</label>
              <input className="form-input" type="date" value={form.purchaseDate} onChange={e => set('purchaseDate', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Expiry Date</label>
              <input className="form-input" type="date" value={form.expiryDate} onChange={e => set('expiryDate', e.target.value)} />
            </div>
            <div className="form-group" style={{ gridColumn:'1/-1' }}>
              <label className="form-label">Notes</label>
              <input className="form-input" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="e.g. Birthday gift" />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => {
            if (!form.purchasedBy.trim() || !form.amount) return
            const amt = parseFloat(form.amount)
            onSave({ ...form, amount: amt, balance: amt, recipientName: form.recipientName || form.purchasedBy })
          }}>
            Issue Gift Card
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Page ────────────────────────────────────────────────── */
export default function GiftCardsPage() {
  const { user, giftCards, addGiftCard, deleteGiftCard, redeemGiftCard } = useApp()
  const [search, setSearch]       = useState('')
  const [selected, setSelected]   = useState(null)
  const [addingNew, setAddingNew] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [importMsg, setImportMsg] = useState('')
  const importRef = useRef(null)

  function handleImportCSV(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const lines = ev.target.result.split('\n').map(l => l.trim()).filter(Boolean)
      if (lines.length < 2) { setImportMsg('No data rows found.'); return }
      const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g,''))
      let imported = 0
      lines.slice(1).forEach(line => {
        const vals = parseCSVLine(line)
        const row = Object.fromEntries(headers.map((h,i) => [h, (vals[i] || '').replace(/^"|"$/g,'')]))
        const purchasedBy = pick(row, 'purchasedby','purchased by','buyer','purchaser','soldto','customer','name','client')
        const amtStr = pick(row, 'amount','value','facevalue','denomination','price','total','balance')
        const amt = parseFloat(amtStr)
        if (!purchasedBy || !amt || isNaN(amt)) return
        const today = new Date().toISOString().split('T')[0]
        const nextYear = `${new Date().getFullYear()+1}-${today.slice(5)}`
        const cardNum = pick(row, 'cardnumber','card number','card#','cardno','gcnumber','giftcardnumber','number','id','card') || nextCardNumber(giftCards)
        addGiftCard({
          cardNumber:    cardNum,
          purchasedBy,
          recipientName: pick(row, 'recipientname','recipient','for','giftfor','givento','recipient name') || purchasedBy,
          purchaseDate:  pick(row, 'purchasedate','purchase date','date','issued','issueddate','saledate') || today,
          expiryDate:    pick(row, 'expirydate','expiry date','expiry','expiration','expirationdate','expires','expdate') || nextYear,
          amount:        amt,
          balance:       amt,
          notes:         pick(row, 'notes','note','comments','comment','memo','description'),
        })
        imported++
      })
      setImportMsg(`Imported ${imported} gift card${imported !== 1 ? 's' : ''}.`)
      setTimeout(() => setImportMsg(''), 3500)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const canEdit = user.role === 'admin' || user.role === 'receptionist'

  const filtered = giftCards.filter(gc => {
    const status = gcStatus(gc)
    const matchStatus = filterStatus === 'all' || status === filterStatus
    const matchSearch = gc.cardNumber.toLowerCase().includes(search.toLowerCase()) ||
      gc.purchasedBy.toLowerCase().includes(search.toLowerCase()) ||
      (gc.recipientName || '').toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const totals = {
    active:   giftCards.filter(g => gcStatus(g) === 'active').length,
    redeemed: giftCards.filter(g => gcStatus(g) === 'redeemed').length,
    expired:  giftCards.filter(g => gcStatus(g) === 'expired').length,
    balance:  giftCards.filter(g => gcStatus(g) === 'active').reduce((s,g) => s+g.balance, 0),
  }

  return (
    <div className="gc-page">
      {/* Toolbar */}
      <div className="gc-toolbar">
        <h2 className="gc-title">Gift Cards</h2>
        <input className="gc-search" placeholder="Search by card #, buyer, or recipient..." value={search} onChange={e => setSearch(e.target.value)} />
        {canEdit && (
          <>
            <button className="gc-btn gc-btn-ghost" onClick={() => importRef.current?.click()}>
              Import CSV
            </button>
            <input ref={importRef} type="file" accept=".csv,text/csv" style={{ display:'none' }} onChange={handleImportCSV} />
            <button className="gc-btn gc-btn-primary" onClick={() => setAddingNew(true)}>+ Issue Gift Card</button>
          </>
        )}
      </div>
      {importMsg && (
        <div style={{ padding:'6px 24px', fontSize:13, color:'#16a34a', fontWeight:600 }}>{importMsg}</div>
      )}

      {/* Summary row */}
      <div className="gc-summary">
        {[
          { label:'Active Cards',    value: totals.active,           color:'#16a34a' },
          { label:'Total Balance',   value:`$${totals.balance.toFixed(2)}`, color:'#16a34a' },
          { label:'Redeemed',        value: totals.redeemed,         color:'#94a3b8' },
          { label:'Expired',         value: totals.expired,          color:'#dc2626' },
        ].map(({ label, value, color }) => (
          <div key={label} className="gc-stat">
            <div style={{ fontSize:24, fontWeight:800, color }}>{value}</div>
            <div style={{ fontSize:11, color:'#94a3b8', fontWeight:600 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filter pills */}
      <div className="gc-filters">
        {['all','active','redeemed','expired'].map(s => (
          <button
            key={s}
            className={`gc-filter-pill${filterStatus === s ? ' active' : ''}`}
            onClick={() => setFilterStatus(s)}
          >
            {s.charAt(0).toUpperCase()+s.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="gc-table-wrap">
        <table className="gc-table">
          <thead>
            <tr>
              <th className="gc-th">Card #</th>
              <th className="gc-th">Purchased By</th>
              <th className="gc-th">Recipient</th>
              <th className="gc-th">Purchase Date</th>
              <th className="gc-th">Expiry Date</th>
              <th className="gc-th">Amount</th>
              <th className="gc-th">Balance</th>
              <th className="gc-th">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(gc => {
              const status = gcStatus(gc)
              const s = STATUS_STYLE[status]
              return (
                <tr key={gc.id} className="gc-row" onClick={() => setSelected(gc)}>
                  <td className="gc-td mono"><span style={{ fontWeight:700, color:'#4f46e5' }}>{gc.cardNumber}</span></td>
                  <td className="gc-td bold">{gc.purchasedBy}</td>
                  <td className="gc-td">{gc.recipientName || gc.purchasedBy}</td>
                  <td className="gc-td">{gc.purchaseDate}</td>
                  <td className="gc-td">{gc.expiryDate}</td>
                  <td className="gc-td">${gc.amount.toFixed(2)}</td>
                  <td className="gc-td bold" style={{ color: status==='active' ? '#16a34a' : '#94a3b8' }}>${gc.balance.toFixed(2)}</td>
                  <td className="gc-td">
                    <span className={`gc-status ${status}`}>
                      <span className="gc-status-dot" />
                      {s.label}
                    </span>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:'#94a3b8', fontSize:14 }}>No gift cards found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <GCViewModal
          gc={giftCards.find(g => g.id === selected.id) ?? selected}
          canEdit={canEdit}
          onClose={() => setSelected(null)}
          onRedeem={(id, amt) => redeemGiftCard(id, amt)}
          onDelete={id => { deleteGiftCard(id); setSelected(null) }}
        />
      )}

      {addingNew && (
        <GCNewModal
          nextNumber={nextCardNumber(giftCards)}
          onClose={() => setAddingNew(false)}
          onSave={gc => { addGiftCard(gc); setAddingNew(false) }}
        />
      )}
    </div>
  )
}
