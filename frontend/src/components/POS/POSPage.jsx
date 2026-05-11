import { useState, useEffect, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { SERVICES } from '../../data/mockData'
import * as api from '../../api'
import './POS.css'
import '../Calendar/Calendar.css'

const TAX_RATE   = 0.06
const TIP_PRESETS = [15, 18, 20, 25]

function fmt(n) { return `$${Number(n || 0).toFixed(2)}` }

function Receipt({ txn, companyInfo, onClose, onNew }) {
  return (
    <div className="pos-receipt-overlay" onClick={onClose}>
      <div className="pos-receipt" onClick={e => e.stopPropagation()}>
        <div className="pos-receipt-header">
          <div className="pos-receipt-title">{companyInfo.name}</div>
          <div className="pos-receipt-sub">{companyInfo.address}</div>
          <div className="pos-receipt-sub">{companyInfo.phone}</div>
          <div className="pos-receipt-sub" style={{ marginTop: 6, fontWeight: 600 }}>
            {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
          </div>
          {txn.clientName && (
            <div className="pos-receipt-sub" style={{ marginTop: 4 }}>Client: {txn.clientName}</div>
          )}
        </div>

        {txn.lineItems.map((item, i) => (
          <div key={i} className="pos-receipt-item">
            <span style={{ flex: 1 }}>{item.service}{item.techName ? ` — ${item.techName}` : ""}</span>
            <span>{fmt(item.price * (item.quantity || 1))}</span>
          </div>
        ))}

        <div className="pos-receipt-totals">
          <div className="pos-receipt-total-row">
            <span>Subtotal</span><span>{fmt(txn.subtotal)}</span>
          </div>
          {txn.discount > 0 && (
            <div className="pos-receipt-total-row" style={{ color: '#10b981' }}>
              <span>Discount</span><span>-{fmt(txn.discount)}</span>
            </div>
          )}
          <div className="pos-receipt-total-row">
            <span>Tax (6%)</span><span>{fmt(txn.tax)}</span>
          </div>
          {txn.tip > 0 && (
            <div className="pos-receipt-total-row">
              <span>Tip</span><span>{fmt(txn.tip)}</span>
            </div>
          )}
          <div className="pos-receipt-total-row grand">
            <span>TOTAL</span><span>{fmt(txn.total)}</span>
          </div>
          {txn.giftCardAmount > 0 && (
            <div className="pos-receipt-total-row" style={{ color: '#6366f1', marginTop: 4 }}>
              <span>Gift Card</span><span>-{fmt(txn.giftCardAmount)}</span>
            </div>
          )}
          {txn.cashAmount > 0 && (
            <div className="pos-receipt-total-row">
              <span>Cash</span><span>{fmt(txn.cashAmount)}</span>
            </div>
          )}
          {txn.cardAmount > 0 && (
            <div className="pos-receipt-total-row">
              <span>Card</span><span>{fmt(txn.cardAmount)}</span>
            </div>
          )}
        </div>

        <div className="pos-receipt-footer">
          Thank you for visiting!<br />
          We appreciate your business.
        </div>

        <div className="pos-receipt-actions">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={onNew}>New Sale</button>
        </div>
      </div>
    </div>
  )
}

export default function POSPage() {
  const { user, technicians, clients, giftCards, redeemGiftCard, companyInfo } = useApp()

  // ── Client selection ─────────────────────────────────────
  const [clientSearch, setClientSearch]   = useState('')
  const [selectedClient, setSelectedClient] = useState(null)
  const [showMatches, setShowMatches]     = useState(false)

  const clientMatches = useMemo(() => {
    if (!clientSearch.trim() || selectedClient) return []
    const q = clientSearch.toLowerCase()
    return clients
      .filter(c => c.name.toLowerCase().includes(q) || (c.phone || '').includes(q))
      .slice(0, 5)
  }, [clientSearch, clients, selectedClient])

  // ── Active technician for service buttons ────────────────
  const [activeTechId, setActiveTechId] = useState(() => technicians[0]?.id || null)

  useEffect(() => {
    if (!activeTechId && technicians.length) setActiveTechId(technicians[0].id)
  }, [technicians])

  // ── Cart ─────────────────────────────────────────────────
  const [cart, setCart] = useState([])

  function addToCart(service) {
    setCart(prev => [
      ...prev,
      { _id: Date.now() + Math.random(), service: service.name, price: service.price, technicianId: activeTechId, quantity: 1 },
    ])
  }

  function removeFromCart(id) {
    setCart(prev => prev.filter(i => i._id !== id))
  }

  // ── Tip ──────────────────────────────────────────────────
  const [tipPct, setTipPct]     = useState(null)  // null = no tip selected
  const [customTip, setCustomTip] = useState('')

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const tax      = subtotal * TAX_RATE
  const tip      = tipPct !== null
    ? subtotal * (tipPct / 100)
    : parseFloat(customTip) || 0

  // ── Payment ──────────────────────────────────────────────
  const [paymentMethod, setPaymentMethod] = useState('cash')  // cash | card | split | gift
  const [gcSearch, setGcSearch]           = useState('')
  const [selectedGC, setSelectedGC]       = useState(null)
  const [gcAmount, setGcAmount]           = useState('')

  const gcMatches = useMemo(() => {
    if (!gcSearch.trim()) return []
    const q = gcSearch.toLowerCase()
    return giftCards
      .filter(g => g.balance > 0 && g.cardNumber.toLowerCase().includes(q))
      .slice(0, 3)
  }, [gcSearch, giftCards])

  const giftCardApplied = selectedGC
    ? Math.min(parseFloat(gcAmount) || selectedGC.balance, subtotal + tax + tip)
    : 0

  const total = Math.max(0, subtotal + tax + tip - giftCardApplied)

  // ── Receipt ───────────────────────────────────────────────
  const [receipt, setReceipt] = useState(null)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  async function handleCharge() {
    if (!cart.length) return
    setSaving(true)
    setError('')
    try {
      const today = new Date().toLocaleDateString('en-CA')  // YYYY-MM-DD local

      let cashAmt = 0, cardAmt = 0
      if (paymentMethod === 'cash')  cashAmt = total
      if (paymentMethod === 'card')  cardAmt = total
      if (paymentMethod === 'split') { cashAmt = total / 2; cardAmt = total / 2 }

      const lineItems = cart.map(i => ({
        technicianId: i.technicianId || null,
        service: i.service,
        price: i.price,
        quantity: i.quantity,
      }))

      const saved = await api.post('/pos/transactions', {
        clientId:    selectedClient?.id || null,
        clientName:  selectedClient?.name || 'Walk-in',
        clientPhone: selectedClient?.phone || '',
        date:        today,
        subtotal, tax, tip, discount: 0, total,
        paymentMethod,
        giftCardId:     selectedGC?.id || null,
        giftCardAmount: giftCardApplied,
        cashAmount:     cashAmt,
        cardAmount:     cardAmt,
        notes: '',
        createdBy: user?.id || null,
        lineItems,
      })

      // Build receipt data including tech names
      const receiptTxn = {
        ...saved,
        lineItems: saved.lineItems.map(li => ({
          ...li,
          techName: technicians.find(t => t.id === li.technicianId)?.name || '',
        })),
      }
      setReceipt(receiptTxn)

      // Deduct gift card optimistically in context
      if (selectedGC && giftCardApplied > 0) {
        redeemGiftCard(selectedGC.id, giftCardApplied)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function resetPOS() {
    setCart([])
    setSelectedClient(null)
    setClientSearch('')
    setTipPct(null)
    setCustomTip('')
    setPaymentMethod('cash')
    setSelectedGC(null)
    setGcSearch('')
    setGcAmount('')
    setReceipt(null)
    setError('')
  }

  // Group services by category for display
  const categories = useMemo(() => {
    const groups = [
      { label: 'Manicures',     names: ['Regular Manicure','Gel Manicure','Shellac Polish','Reg Polish - Hands','Reg Polish - Toes'] },
      { label: 'Pedicures',     names: ['Regular Pedicure','Gel Pedicure','Special Pedicure','Deluxe Pedicure','Reg Mani+Pedi Combo','Kids Pedicure','Kids Polish','Kids Mani+Pedi'] },
      { label: 'Acrylic',       names: ['Acrylic Full Set','Acrylic Full Set (Gel)','Acrylic Fill','Acrylic Fill (Gel)','Pink & White Full Set','Pink & White Fill','Pink Fill'] },
      { label: 'Builder Gel',   names: ['Builder Gel Full Set','Builder Gel Fill'] },
      { label: 'Dip Powder',    names: ['Dip Powder','Ombre Dipping','French Dip','Dip with Tips'] },
      { label: 'Add-ons',       names: ['Gel Polish Add-On','Nail Designs','Nail Repair','Shellac Take Off','Dip/Acrylic Take Off','Consultation'] },
    ]
    return groups.map(g => ({
      ...g,
      services: g.names.map(n => SERVICES.find(s => s.name === n)).filter(Boolean),
    }))
  }, [])

  return (
    <div className="pos-page">
      {/* ── Left panel: client + services ── */}
      <div className="pos-left">
        <div className="pos-left-header">
          <h2>Point of Sale</h2>

          {/* Client search / selection */}
          <div style={{ position: 'relative' }}>
            <div className="pos-client-row">
              {selectedClient ? (
                <div className="pos-client-chip">
                  <span style={{ fontSize: 16 }}>👤</span>
                  <span className="pos-client-chip-name">{selectedClient.name}</span>
                  {selectedClient.phone && (
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{selectedClient.phone}</span>
                  )}
                  <button className="pos-client-chip-clear" onClick={() => setSelectedClient(null)}>×</button>
                </div>
              ) : (
                <>
                  <input
                    className="pos-client-search"
                    placeholder="Search client by name or phone…"
                    value={clientSearch}
                    onChange={e => { setClientSearch(e.target.value); setShowMatches(true) }}
                    onFocus={() => setShowMatches(true)}
                    onBlur={() => setTimeout(() => setShowMatches(false), 150)}
                  />
                  <button className="pos-walkin-btn" onClick={() => { setSelectedClient({ name: 'Walk-in', phone: '' }); setClientSearch('') }}>
                    Walk-in
                  </button>
                </>
              )}
            </div>
            {showMatches && clientMatches.length > 0 && (
              <div className="pos-client-matches">
                {clientMatches.map(c => (
                  <div key={c.id} className="pos-client-match"
                    onMouseDown={() => { setSelectedClient(c); setClientSearch(''); setShowMatches(false) }}>
                    <span className="pos-client-match-name">{c.name}</span>
                    <span className="pos-client-match-phone">{c.phone}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tech selector */}
        <div className="pos-service-scroll">
          <div className="pos-tech-select-row">
            <span className="pos-tech-select-label">Tech:</span>
            <select
              className="pos-tech-select"
              value={activeTechId || ''}
              onChange={e => setActiveTechId(Number(e.target.value))}
            >
              {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {categories.map(cat => (
            <div key={cat.label} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{cat.label}</div>
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

      {/* ── Right panel: cart + checkout ── */}
      <div className="pos-right">
        <div className="pos-right-header">
          <h2>Cart {cart.length > 0 ? `(${cart.length})` : ''}</h2>
        </div>

        {/* Cart items */}
        <div className="pos-cart">
          {cart.length === 0 ? (
            <div className="pos-cart-empty">
              <span style={{ fontSize: 32 }}>🛒</span>
              <span>Tap a service to add it</span>
            </div>
          ) : (
            cart.map(item => (
              <div key={item._id} className="pos-cart-item">
                <div className="pos-cart-item-info">
                  <div className="pos-cart-item-name">{item.service}</div>
                  <div className="pos-cart-item-tech">
                    {technicians.find(t => t.id === item.technicianId)?.name || '—'}
                  </div>
                </div>
                <span className="pos-cart-item-price">{fmt(item.price)}</span>
                <button className="pos-cart-item-remove" onClick={() => removeFromCart(item._id)}>×</button>
              </div>
            ))
          )}
        </div>

        {/* Totals + tip */}
        <div className="pos-totals">
          <div className="pos-total-row">
            <span>Subtotal</span><span>{fmt(subtotal)}</span>
          </div>
          <div className="pos-total-row">
            <span>Tax (6%)</span><span>{fmt(tax)}</span>
          </div>

          {/* Tip */}
          <div className="pos-tip-row">
            <span className="pos-tip-label">Tip:</span>
            <div className="pos-tip-btns">
              <button className={`pos-tip-btn${tipPct === 0 ? ' active' : ''}`}
                onClick={() => { setTipPct(0); setCustomTip('') }}>No tip</button>
              {TIP_PRESETS.map(p => (
                <button key={p} className={`pos-tip-btn${tipPct === p ? ' active' : ''}`}
                  onClick={() => { setTipPct(p); setCustomTip('') }}>{p}%</button>
              ))}
            </div>
            <input
              className="pos-tip-input"
              placeholder="$0"
              value={customTip}
              onChange={e => { setCustomTip(e.target.value); setTipPct(null) }}
              style={{ marginLeft: 4 }}
            />
          </div>

          {tip > 0 && <div className="pos-total-row"><span>Tip</span><span>{fmt(tip)}</span></div>}
          {giftCardApplied > 0 && (
            <div className="pos-total-row" style={{ color: '#6366f1' }}>
              <span>Gift Card</span><span>-{fmt(giftCardApplied)}</span>
            </div>
          )}
          <div className="pos-total-row grand">
            <span>TOTAL</span><span>{fmt(total)}</span>
          </div>
        </div>

        {/* Payment method */}
        <div className="pos-payment-section">
          <div className="pos-payment-label">Payment Method</div>
          <div className="pos-payment-btns">
            {[
              { id: 'cash', icon: '💵', label: 'Cash' },
              { id: 'card', icon: '💳', label: 'Card' },
              { id: 'split', icon: '↔️', label: 'Split' },
              { id: 'gift', icon: '🎁', label: 'Gift Card' },
            ].map(m => (
              <button key={m.id}
                className={`pos-payment-btn${paymentMethod === m.id ? ' active' : ''}`}
                onClick={() => setPaymentMethod(m.id)}>
                <span className="pos-payment-btn-icon">{m.icon}</span>
                {m.label}
              </button>
            ))}
          </div>

          {/* Gift card lookup */}
          {(paymentMethod === 'gift' || selectedGC) && (
            selectedGC ? (
              <div className="pos-gc-chip">
                <span>🎁</span>
                <span style={{ flex: 1 }}>{selectedGC.cardNumber}</span>
                <span style={{ fontWeight: 700 }}>Balance: {fmt(selectedGC.balance)}</span>
                <button className="pos-gc-chip-clear" onClick={() => { setSelectedGC(null); setGcSearch(''); setGcAmount('') }}>×</button>
              </div>
            ) : (
              <div>
                <div className="pos-gc-row">
                  <input
                    className="pos-gc-input"
                    placeholder="Card number…"
                    value={gcSearch}
                    onChange={e => setGcSearch(e.target.value)}
                  />
                  <button className="pos-gc-apply-btn"
                    onClick={() => {
                      const found = giftCards.find(g => g.cardNumber.toLowerCase() === gcSearch.toLowerCase() && g.balance > 0)
                      if (found) { setSelectedGC(found); setGcAmount(String(Math.min(found.balance, subtotal + tax + tip).toFixed(2))) }
                    }}>
                    Apply
                  </button>
                </div>
                {gcMatches.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    {gcMatches.map(g => (
                      <div key={g.id}
                        style={{ padding: '6px 10px', cursor: 'pointer', background: '#f8fafc', borderRadius: 6, fontSize: 12, marginBottom: 4 }}
                        onClick={() => { setSelectedGC(g); setGcAmount(String(Math.min(g.balance, subtotal + tax + tip).toFixed(2))) }}>
                        {g.cardNumber} — Balance: {fmt(g.balance)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          )}
        </div>

        {error && (
          <div style={{ padding: '6px 16px', fontSize: 12, color: '#dc2626', background: '#fee2e2' }}>{error}</div>
        )}

        <button
          className="pos-charge-btn"
          onClick={handleCharge}
          disabled={cart.length === 0 || saving}
        >
          {saving ? 'Processing…' : `Charge ${fmt(total)}`}
        </button>
      </div>

      {receipt && (
        <Receipt
          txn={receipt}
          companyInfo={companyInfo}
          onClose={() => setReceipt(null)}
          onNew={resetPOS}
        />
      )}
    </div>
  )
}
