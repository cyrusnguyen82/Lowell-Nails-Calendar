import { useState, useEffect, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { SERVICES } from '../../data/mockData'
import * as api from '../../api'
import './POS.css'

/* ── Closed Tickets (read-only) ─────────────────────────────── */
function ClosedTicketsView({ onBack }) {
  const { technicians } = useApp()
  const [txns, setTxns]       = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [search, setSearch]   = useState('')

  useEffect(() => {
    api.get('/pos/transactions')
      .then(data => { setTxns(data.sort((a,b) => b.date.localeCompare(a.date) || b.id - a.id)); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function techName(id) { return technicians.find(t => t.id === id)?.name || '—' }
  function techColor(id) { return technicians.find(t => t.id === id)?.color || '#94a3b8' }

  const filtered = txns.filter(t =>
    !search ||
    (t.clientName || '').toLowerCase().includes(search.toLowerCase()) ||
    String(t.id).includes(search) ||
    (t.date || '').includes(search)
  )

  return (
    <div className="pos-shell">
      <div className="pos-closed-view">
        <div className="pos-closed-header">
          <button className="pos-back-btn" onClick={onBack}>← Back</button>
          <span className="pos-checkout-title">Closed Tickets</span>
          <input className="pos-panel-search"
            style={{ background:'rgba(255,255,255,0.15)', maxWidth:220 }}
            placeholder="Search client, date, #ticket…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="pos-closed-list">
          {loading && (
            <div style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>Loading…</div>
          )}
          {!loading && filtered.length === 0 && (
            <div style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>No closed tickets found</div>
          )}
          {filtered.map(txn => (
            <div key={txn.id}
              className={`pos-closed-card${expanded === txn.id ? ' expanded' : ''}`}
              onClick={() => setExpanded(expanded === txn.id ? null : txn.id)}>
              <div className="pos-closed-card-row">
                <span className="pos-closed-num">#{txn.id}</span>
                <span className="pos-closed-client">{txn.clientName || 'Walk-in'}</span>
                <span className="pos-closed-date">{txn.date}</span>
                <span className="pos-closed-method">{(txn.paymentMethod || '').toUpperCase()}</span>
                <span className="pos-closed-total">${(txn.total || 0).toFixed(2)}</span>
                <span className="pos-closed-chevron">{expanded === txn.id ? '▲' : '▼'}</span>
              </div>

              {expanded === txn.id && (
                <div className="pos-closed-details">
                  {(txn.lineItems || []).map((li, i) => (
                    <div key={i} className="pos-closed-line">
                      <div className="pos-closed-line-dot" style={{ background: techColor(li.technicianId) }} />
                      <span className="pos-closed-line-svc">{li.service}</span>
                      <span className="pos-closed-line-tech">{techName(li.technicianId)}</span>
                      <span className="pos-closed-line-price">${(li.price || 0).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="pos-closed-totals-row">
                    <span>Subtotal ${(txn.subtotal || 0).toFixed(2)}</span>
                    <span>Tax ${(txn.tax || 0).toFixed(2)}</span>
                    {txn.tip > 0 && <span>Tip ${(txn.tip || 0).toFixed(2)}</span>}
                    {txn.giftCardAmount > 0 && <span style={{color:'#3ab592'}}>Gift Card -${(txn.giftCardAmount || 0).toFixed(2)}</span>}
                    <strong>Total ${(txn.total || 0).toFixed(2)}</strong>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="pos-bar">
        <button className="pos-bar-btn pos-bar-primary" onClick={onBack}>← BACK</button>
      </div>
    </div>
  )
}

const TAX_RATE    = 0.06
const TIP_PRESETS = [15, 18, 20, 25]

function fmt(n) { return `$${Number(n || 0).toFixed(2)}` }

/* ── Receipt ────────────────────────────────────────────────── */
function Receipt({ txn, companyInfo, onClose, onNew }) {
  return (
    <div className="pos-receipt-overlay" onClick={onClose}>
      <div className="pos-receipt" onClick={e => e.stopPropagation()}>
        <div className="pos-receipt-header">
          <div className="pos-receipt-title">{companyInfo.name}</div>
          <div className="pos-receipt-sub">{companyInfo.address}</div>
          <div className="pos-receipt-sub">{companyInfo.phone}</div>
          <div className="pos-receipt-sub" style={{ marginTop: 6, fontWeight: 600 }}>
            {new Date().toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' })}
          </div>
          {txn.clientName && <div className="pos-receipt-sub" style={{ marginTop: 4 }}>Client: {txn.clientName}</div>}
        </div>
        {txn.lineItems.map((item, i) => (
          <div key={i} className="pos-receipt-item">
            <span style={{ flex: 1 }}>{item.service}{item.techName ? ` — ${item.techName}` : ''}</span>
            <span>{fmt(item.price)}</span>
          </div>
        ))}
        <div className="pos-receipt-totals">
          <div className="pos-receipt-row"><span>Subtotal</span><span>{fmt(txn.subtotal)}</span></div>
          {txn.discount > 0 && (
            <div className="pos-receipt-row" style={{ color: '#10b981' }}>
              <span>Discount</span><span>-{fmt(txn.discount)}</span>
            </div>
          )}
          <div className="pos-receipt-row"><span>Tax (6%)</span><span>{fmt(txn.tax)}</span></div>
          {txn.tip > 0 && <div className="pos-receipt-row"><span>Tip</span><span>{fmt(txn.tip)}</span></div>}
          <div className="pos-receipt-row grand"><span>TOTAL</span><span>{fmt(txn.total)}</span></div>
          {txn.giftCardAmount > 0 && (
            <div className="pos-receipt-row" style={{ color: '#3ab592' }}>
              <span>Gift Card</span><span>-{fmt(txn.giftCardAmount)}</span>
            </div>
          )}
          {txn.cashAmount > 0 && <div className="pos-receipt-row"><span>Cash</span><span>{fmt(txn.cashAmount)}</span></div>}
          {txn.cardAmount > 0 && <div className="pos-receipt-row"><span>Card</span><span>{fmt(txn.cardAmount)}</span></div>}
        </div>
        <div className="pos-receipt-footer">Thank you for visiting!<br />We appreciate your business.</div>
        <div className="pos-receipt-actions">
          <button className="pos-btn pos-btn-ghost" onClick={onClose}>Close</button>
          <button className="pos-btn pos-btn-primary" onClick={onNew}>New Sale</button>
        </div>
      </div>
    </div>
  )
}

/* ── Checkout view ──────────────────────────────────────────── */
function CheckoutView({ initialTechId, onBack }) {
  const { user, technicians, clients, giftCards, redeemGiftCard, companyInfo } = useApp()

  const [clientSearch, setClientSearch]   = useState('')
  const [selectedClient, setSelectedClient] = useState(null)
  const [showMatches, setShowMatches]     = useState(false)
  const [activeTechId, setActiveTechId]   = useState(initialTechId || technicians[0]?.id || null)
  const [cart, setCart]                   = useState([])
  const [tipPct, setTipPct]               = useState(null)
  const [customTip, setCustomTip]         = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [gcSearch, setGcSearch]           = useState('')
  const [selectedGC, setSelectedGC]       = useState(null)
  const [gcAmount, setGcAmount]           = useState('')
  const [receipt, setReceipt]             = useState(null)
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState('')

  useEffect(() => {
    if (!activeTechId && technicians.length) setActiveTechId(technicians[0].id)
  }, [technicians])

  const clientMatches = useMemo(() => {
    if (!clientSearch.trim() || selectedClient) return []
    const q = clientSearch.toLowerCase()
    return clients.filter(c => c.name.toLowerCase().includes(q) || (c.phone || '').includes(q)).slice(0, 5)
  }, [clientSearch, clients, selectedClient])

  const gcMatches = useMemo(() => {
    if (!gcSearch.trim()) return []
    const q = gcSearch.toLowerCase()
    return giftCards.filter(g => g.balance > 0 && g.cardNumber.toLowerCase().includes(q)).slice(0, 3)
  }, [gcSearch, giftCards])

  function addToCart(svc) {
    setCart(prev => [...prev, { _id: Date.now() + Math.random(), service: svc.name, price: svc.price, technicianId: activeTechId, quantity: 1 }])
  }
  function removeFromCart(id) { setCart(prev => prev.filter(i => i._id !== id)) }

  const subtotal        = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const tax             = subtotal * TAX_RATE
  const tip             = tipPct !== null ? subtotal * (tipPct / 100) : parseFloat(customTip) || 0
  const giftCardApplied = selectedGC ? Math.min(parseFloat(gcAmount) || selectedGC.balance, subtotal + tax + tip) : 0
  const total           = Math.max(0, subtotal + tax + tip - giftCardApplied)

  const categories = useMemo(() => [
    { label: 'Manicures',   names: ['Regular Manicure','Gel Manicure','Shellac Polish','Reg Polish - Hands','Reg Polish - Toes'] },
    { label: 'Pedicures',   names: ['Regular Pedicure','Gel Pedicure','Special Pedicure','Deluxe Pedicure','Reg Mani+Pedi Combo','Kids Pedicure','Kids Polish','Kids Mani+Pedi'] },
    { label: 'Acrylic',     names: ['Acrylic Full Set','Acrylic Full Set (Gel)','Acrylic Fill','Acrylic Fill (Gel)','Pink & White Full Set','Pink & White Fill','Pink Fill'] },
    { label: 'Builder Gel', names: ['Builder Gel Full Set','Builder Gel Fill'] },
    { label: 'Dip Powder',  names: ['Dip Powder','Ombre Dipping','French Dip','Dip with Tips'] },
    { label: 'Add-ons',     names: ['Gel Polish Add-On','Nail Designs','Nail Repair','Shellac Take Off','Dip/Acrylic Take Off','Consultation'] },
  ].map(g => ({ ...g, services: g.names.map(n => SERVICES.find(s => s.name === n)).filter(Boolean) })), [])

  async function handleCharge() {
    if (!cart.length) return
    setSaving(true); setError('')
    try {
      const today = new Date().toLocaleDateString('en-CA')
      let cashAmt = 0, cardAmt = 0
      if (paymentMethod === 'cash')  cashAmt = total
      if (paymentMethod === 'card')  cardAmt = total
      if (paymentMethod === 'split') { cashAmt = total / 2; cardAmt = total / 2 }
      const saved = await api.post('/pos/transactions', {
        clientId: selectedClient?.id || null,
        clientName: selectedClient?.name || 'Walk-in',
        clientPhone: selectedClient?.phone || '',
        date: today, subtotal, tax, tip, discount: 0, total, paymentMethod,
        giftCardId: selectedGC?.id || null, giftCardAmount: giftCardApplied,
        cashAmount: cashAmt, cardAmount: cardAmt, notes: '',
        createdBy: user?.id || null,
        lineItems: cart.map(i => ({ technicianId: i.technicianId || null, service: i.service, price: i.price, quantity: i.quantity })),
      })
      const receiptTxn = {
        ...saved,
        lineItems: saved.lineItems.map(li => ({ ...li, techName: technicians.find(t => t.id === li.technicianId)?.name || '' })),
      }
      setReceipt(receiptTxn)
      if (selectedGC && giftCardApplied > 0) redeemGiftCard(selectedGC.id, giftCardApplied)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (receipt) {
    return (
      <Receipt
        txn={receipt}
        companyInfo={companyInfo}
        onClose={onBack}
        onNew={() => {
          setCart([]); setSelectedClient(null); setClientSearch('');
          setTipPct(null); setCustomTip(''); setPaymentMethod('cash');
          setSelectedGC(null); setGcSearch(''); setGcAmount(''); setReceipt(null);
        }}
      />
    )
  }

  return (
    <div className="pos-checkout">
      <div className="pos-checkout-header">
        <button className="pos-back-btn" onClick={onBack}>← Back</button>
        <span className="pos-checkout-title">Open Ticket</span>
        {selectedClient && (
          <span className="pos-checkout-client-badge">👤 {selectedClient.name}</span>
        )}
      </div>

      <div className="pos-checkout-body">
        {/* ── Left: client + tech + services ── */}
        <div className="pos-checkout-left">
          {/* Client */}
          <div className="pos-co-section">
            <div className="pos-co-label">Client</div>
            <div style={{ position: 'relative' }}>
              {selectedClient ? (
                <div className="pos-client-chip">
                  <span>👤</span>
                  <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{selectedClient.name}</span>
                  {selectedClient.phone && <span style={{ fontSize: 11, color: '#64748b' }}>{selectedClient.phone}</span>}
                  <button onClick={() => setSelectedClient(null)} className="pos-chip-clear">×</button>
                </div>
              ) : (
                <div className="pos-co-row">
                  <input
                    className="pos-co-input"
                    placeholder="Search client or phone…"
                    value={clientSearch}
                    onChange={e => { setClientSearch(e.target.value); setShowMatches(true) }}
                    onFocus={() => setShowMatches(true)}
                    onBlur={() => setTimeout(() => setShowMatches(false), 150)}
                  />
                  <button className="pos-walkin-btn"
                    onClick={() => { setSelectedClient({ name: 'Walk-in', phone: '' }); setClientSearch('') }}>
                    Walk-in
                  </button>
                </div>
              )}
              {showMatches && clientMatches.length > 0 && (
                <div className="pos-client-matches">
                  {clientMatches.map(c => (
                    <div key={c.id} className="pos-client-match"
                      onMouseDown={() => { setSelectedClient(c); setClientSearch(''); setShowMatches(false) }}>
                      <span style={{ fontWeight: 600 }}>{c.name}</span>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>{c.phone}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tech */}
          <div className="pos-co-section">
            <div className="pos-co-label">Technician</div>
            <div className="pos-tech-pills">
              {technicians.map(t => (
                <button key={t.id}
                  className={`pos-tech-pill${activeTechId === t.id ? ' active' : ''}`}
                  style={activeTechId === t.id ? { background: t.color, borderColor: t.color } : {}}
                  onClick={() => setActiveTechId(t.id)}>
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          {/* Services */}
          <div className="pos-co-section pos-services-section">
            <div className="pos-co-label">Services</div>
            <div className="pos-service-scroll">
              {categories.map(cat => (
                <div key={cat.label} style={{ marginBottom: 12 }}>
                  <div className="pos-cat-label">{cat.label}</div>
                  <div className="pos-service-grid">
                    {cat.services.map(svc => (
                      <button key={svc.name} className="pos-service-btn" onClick={() => addToCart(svc)}>
                        <span className="pos-service-btn-name">{svc.name}</span>
                        <span className="pos-service-btn-price">${svc.price}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: cart + payment ── */}
        <div className="pos-checkout-right">
          <div style={{ padding: '10px 12px 6px' }}>
            <div className="pos-co-label">Cart {cart.length > 0 && `(${cart.length})`}</div>
          </div>

          <div className="pos-cart">
            {cart.length === 0 ? (
              <div className="pos-cart-empty">Tap a service to add</div>
            ) : cart.map(item => (
              <div key={item._id} className="pos-cart-item">
                <div style={{ flex: 1 }}>
                  <div className="pos-cart-item-name">{item.service}</div>
                  <div className="pos-cart-item-tech">{technicians.find(t => t.id === item.technicianId)?.name || '—'}</div>
                </div>
                <span className="pos-cart-item-price">{fmt(item.price)}</span>
                <button className="pos-cart-item-remove" onClick={() => removeFromCart(item._id)}>×</button>
              </div>
            ))}
          </div>

          <div className="pos-totals">
            <div className="pos-total-row"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
            <div className="pos-total-row"><span>Tax (6%)</span><span>{fmt(tax)}</span></div>
            <div className="pos-tip-row">
              <span style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>Tip:</span>
              <div style={{ display: 'flex', gap: 4, flex: 1, flexWrap: 'wrap' }}>
                <button className={`pos-tip-btn${tipPct === 0 ? ' active' : ''}`}
                  onClick={() => { setTipPct(0); setCustomTip('') }}>No tip</button>
                {TIP_PRESETS.map(p => (
                  <button key={p} className={`pos-tip-btn${tipPct === p ? ' active' : ''}`}
                    onClick={() => { setTipPct(p); setCustomTip('') }}>{p}%</button>
                ))}
              </div>
              <input className="pos-tip-input" placeholder="$"
                value={customTip} onChange={e => { setCustomTip(e.target.value); setTipPct(null) }} />
            </div>
            {tip > 0 && <div className="pos-total-row"><span>Tip</span><span>{fmt(tip)}</span></div>}
            {giftCardApplied > 0 && (
              <div className="pos-total-row" style={{ color: '#3ab592' }}>
                <span>Gift Card</span><span>-{fmt(giftCardApplied)}</span>
              </div>
            )}
            <div className="pos-total-row grand"><span>TOTAL</span><span>{fmt(total)}</span></div>
          </div>

          <div className="pos-payment-section">
            <div className="pos-co-label" style={{ marginBottom: 8 }}>Payment Method</div>
            <div className="pos-payment-btns">
              {[
                { id: 'cash',  icon: '💵', label: 'Cash' },
                { id: 'card',  icon: '💳', label: 'Card' },
                { id: 'split', icon: '↔',  label: 'Split' },
                { id: 'gift',  icon: '🎁', label: 'Gift Card' },
              ].map(m => (
                <button key={m.id}
                  className={`pos-payment-btn${paymentMethod === m.id ? ' active' : ''}`}
                  onClick={() => setPaymentMethod(m.id)}>
                  <span style={{ fontSize: 16 }}>{m.icon}</span>{m.label}
                </button>
              ))}
            </div>

            {paymentMethod === 'gift' && (
              selectedGC ? (
                <div className="pos-gc-chip">
                  <span>🎁</span>
                  <span style={{ flex: 1 }}>{selectedGC.cardNumber}</span>
                  <span style={{ fontWeight: 700 }}>Bal: {fmt(selectedGC.balance)}</span>
                  <button onClick={() => { setSelectedGC(null); setGcSearch(''); setGcAmount('') }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3ab592', fontSize: 16 }}>×</button>
                </div>
              ) : (
                <div>
                  <div className="pos-gc-row">
                    <input className="pos-gc-input" placeholder="Gift card number…"
                      value={gcSearch} onChange={e => setGcSearch(e.target.value)} />
                    <button className="pos-gc-apply-btn" onClick={() => {
                      const found = giftCards.find(g => g.cardNumber.toLowerCase() === gcSearch.toLowerCase() && g.balance > 0)
                      if (found) { setSelectedGC(found); setGcAmount(String(Math.min(found.balance, subtotal + tax + tip).toFixed(2))) }
                    }}>Apply</button>
                  </div>
                  {gcMatches.map(g => (
                    <div key={g.id}
                      style={{ padding: '6px 10px', cursor: 'pointer', background: '#f8fafc', borderRadius: 6, fontSize: 12, marginTop: 4 }}
                      onClick={() => { setSelectedGC(g); setGcAmount(String(Math.min(g.balance, subtotal + tax + tip).toFixed(2))) }}>
                      {g.cardNumber} — Balance: {fmt(g.balance)}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          {error && (
            <div style={{ margin: '0 12px 8px', padding: '6px 10px', fontSize: 12, color: '#dc2626', background: '#fee2e2', borderRadius: 6 }}>
              {error}
            </div>
          )}

          <button className="pos-charge-btn" onClick={handleCharge} disabled={cart.length === 0 || saving}>
            {saving ? 'Processing…' : `Charge ${fmt(total)}`}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Main POS dashboard ─────────────────────────────────────── */
export default function POSPage({ onNavigate }) {
  const { user, technicians, appointments } = useApp()
  const [mode, setMode]               = useState('main')  // 'main' | 'checkout' | 'closed'
  const [selectedTechId, setSelectedTechId] = useState(null)
  const [ticketSearch, setTicketSearch] = useState('')
  const [techSearch, setTechSearch]   = useState('')

  const today = new Date().toLocaleDateString('en-CA')
  const now   = new Date()
  const nowMins = now.getHours() * 60 + now.getMinutes()

  const todayApts = useMemo(() =>
    appointments.filter(a => a.date === today).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [appointments, today]
  )

  function toMins(timeStr) {
    const [h, m] = timeStr.split(':').map(Number)
    return h * 60 + m
  }

  const workingTechIds = useMemo(() => new Set(
    todayApts
      .filter(a => { const s = toMins(a.startTime); return nowMins >= s && nowMins < s + (a.duration || 60) })
      .map(a => a.technicianId)
  ), [todayApts, nowMins])

  function techAptCount(techId) {
    return todayApts.filter(a => a.technicianId === techId).length
  }

  function getCurrentApt(techId) {
    return todayApts.find(a => {
      const s = toMins(a.startTime)
      return a.technicianId === techId && nowMins >= s && nowMins < s + (a.duration || 60)
    })
  }

  const filteredTickets = useMemo(() =>
    todayApts.filter(a => !ticketSearch ||
      a.clientName.toLowerCase().includes(ticketSearch.toLowerCase()) ||
      a.startTime.includes(ticketSearch)
    ), [todayApts, ticketSearch]
  )

  const availableTechs = useMemo(() =>
    technicians.filter(t => !workingTechIds.has(t.id) &&
      (!techSearch || t.name.toLowerCase().includes(techSearch.toLowerCase()))
    ), [technicians, workingTechIds, techSearch]
  )

  const workingTechs = useMemo(() =>
    technicians.filter(t => workingTechIds.has(t.id)),
    [technicians, workingTechIds]
  )

  function openCheckout(techId) {
    setSelectedTechId(techId || null)
    setMode('checkout')
  }

  if (mode === 'closed') {
    return <ClosedTicketsView onBack={() => setMode('main')} />
  }

  if (mode === 'checkout') {
    return (
      <div className="pos-shell">
        <CheckoutView initialTechId={selectedTechId} onBack={() => setMode('main')} />
      </div>
    )
  }

  return (
    <div className="pos-shell">
      {/* ── Three panels ── */}
      <div className="pos-panels">

        {/* Waiting List */}
        <div className="pos-panel">
          <div className="pos-panel-head">
            <span>WAITING LIST</span>
            <input className="pos-panel-search" placeholder="Name/Phone/Ticket"
              value={ticketSearch} onChange={e => setTicketSearch(e.target.value)} />
          </div>
          <div className="pos-panel-body">
            {filteredTickets.length === 0 ? (
              <div className="pos-panel-empty">No appointments today</div>
            ) : filteredTickets.map((apt, i) => {
              const tech    = technicians.find(t => t.id === apt.technicianId)
              const working = workingTechIds.has(apt.technicianId)
              return (
                <div key={apt.id} className={`pos-ticket${working ? ' working' : ''}`}
                  onClick={() => openCheckout(apt.technicianId)}>
                  <div className="pos-ticket-top">
                    <span className="pos-ticket-num">#{String(i + 1).padStart(2, '0')} {apt.clientName}</span>
                    {working && <span className="pos-ticket-badge">IN SERVICE</span>}
                    <span className="pos-ticket-print">🖨</span>
                  </div>
                  <div className="pos-ticket-row">
                    <span className="pos-ticket-time">⏰ {apt.startTime}</span>
                    <span className="pos-ticket-service">{apt.service}</span>
                  </div>
                  {tech && <div className="pos-ticket-tech" style={{ color: tech.color }}>{tech.name.toUpperCase()}</div>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Available Techs */}
        <div className="pos-panel">
          <div className="pos-panel-head">
            <span>AVAILABLE TECHS</span>
            <input className="pos-panel-search" placeholder="Name"
              value={techSearch} onChange={e => setTechSearch(e.target.value)} />
            <button className="pos-new-ticket-btn" onClick={() => openCheckout(null)}>+ New Ticket</button>
          </div>
          <div className="pos-panel-body">
            {availableTechs.length === 0 ? (
              <div className="pos-panel-empty">All techs are currently busy</div>
            ) : (
              <div className="pos-tech-grid">
                {availableTechs.map(tech => (
                  <div key={tech.id} className="pos-tech-card" onClick={() => openCheckout(tech.id)}>
                    <span className="pos-tech-card-badge">{techAptCount(tech.id)}</span>
                    <div className="pos-tech-card-avatar" style={{ background: tech.color }}>
                      {tech.initials}
                    </div>
                    <span className="pos-tech-card-name">{tech.name.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Working Techs */}
        <div className="pos-panel">
          <div className="pos-panel-head">
            <span>WORKING TECHS</span>
            <input className="pos-panel-search" placeholder="Name/Phone/Ticket" readOnly />
          </div>
          <div className="pos-panel-body">
            {workingTechs.length === 0 ? (
              <div className="pos-panel-empty">No techs currently in service</div>
            ) : workingTechs.map(tech => {
              const apt = getCurrentApt(tech.id)
              return (
                <div key={tech.id} className="pos-working-card">
                  <div className="pos-working-avatar" style={{ background: tech.color }}>{tech.initials}</div>
                  <div className="pos-working-info">
                    <div className="pos-working-name">{tech.name}</div>
                    {apt && (
                      <>
                        <div className="pos-working-client">{apt.clientName}</div>
                        <div className="pos-working-service">{apt.service}</div>
                        <div className="pos-working-time">Started {apt.startTime}</div>
                      </>
                    )}
                  </div>
                  <span className="pos-working-status">BUSY</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Bottom action bar — 4 buttons ── */}
      <div className="pos-bar">
        <button className="pos-bar-btn pos-bar-primary" onClick={() => setMode('closed')}>
          <span className="pos-bar-icon">📋</span>
          <span>CLOSED TICKET</span>
        </button>
        <button className="pos-bar-btn" onClick={() => onNavigate?.('calendar')}>
          <span className="pos-bar-icon">📅</span>
          <span>APPOINTMENT</span>
        </button>
        <button className="pos-bar-btn" onClick={() => onNavigate?.('clients')}>
          <span className="pos-bar-icon">👥</span>
          <span>CLIENTS</span>
        </button>
        <button className="pos-bar-btn" onClick={() => onNavigate?.('admin')}>
          <span className="pos-bar-icon">⚙️</span>
          <span>ADMIN</span>
        </button>
      </div>
    </div>
  )
}
