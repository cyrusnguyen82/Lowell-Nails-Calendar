import React, { useState, useMemo, useEffect } from 'react';
import {
  User, Trash2, ShoppingCart, HandMetal, Waves, Sparkles,
  Tag, Clock, LogIn, LogOut, AlertCircle, CheckCircle2, Loader2,
  ChevronLeft, Search, Receipt, CreditCard, Banknote, UserCheck, Plus,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import * as api from '../../api';
import './POS.css';

const CATEGORIES = [
  { id: 'all',     name: 'All',         icon: <ShoppingCart size={13} /> },
  { id: 'mani',    name: 'Manicure',    icon: <HandMetal size={13} /> },
  { id: 'pedi',    name: 'Pedicure',    icon: <Waves size={13} /> },
  { id: 'acrylic', name: 'Acrylic',     icon: <Sparkles size={13} /> },
  { id: 'dip',     name: 'Dipping',     icon: <Sparkles size={13} /> },
  { id: 'gel',     name: 'Builder Gel', icon: <Sparkles size={13} /> },
  { id: 'kids',    name: 'Kids',        icon: <User size={13} /> },
  { id: 'addons',  name: 'Add-Ons',     icon: <Tag size={13} /> },
];

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h);
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
}

// ── Toast ────────────────────────────────────────────────────────
function Toast({ message, type = 'success', onDismiss }) {
  useEffect(() => { const t = setTimeout(onDismiss, 3500); return () => clearTimeout(t); }, [onDismiss]);
  return (
    <div className={`toast-alert toast-${type}`} onClick={onDismiss}>
      {type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
      <span>{message}</span>
    </div>
  );
}

// ── Timeclock Panel ──────────────────────────────────────────────
function TimeclockPanel({ onClose }) {
  const { clockStatus, clockIn, clockOut } = useApp();
  const [loading, setLoading] = useState(null);
  const [toast, setToast] = useState(null);

  const handle = async (techId, isClockedIn) => {
    setLoading(techId);
    try {
      if (isClockedIn) {
        const res = await clockOut(techId);
        setToast({ message: `Clocked out · ${res.hours} hrs`, type: 'success' });
      } else {
        await clockIn(techId);
        setToast({ message: 'Clocked in', type: 'success' });
      }
    } catch { setToast({ message: 'Action failed', type: 'error' }); }
    finally { setLoading(null); }
  };

  return (
    <div className="pos-overlay">
      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
      <div className="pos-modal">
        <div className="pos-modal-header">
          <h2 className="pos-modal-title"><Clock size={18} /> STAFF TIMECLOCK</h2>
          <button className="pos-btn-icon" onClick={onClose}>×</button>
        </div>
        <div className="pos-modal-body">
          <div className="pos-staff-list">
            {clockStatus.map(s => (
              <div key={s.id} className="pos-staff-row">
                <div className="pos-staff-info">
                  <div className="pos-staff-name">{s.name}</div>
                  <div className={`pos-staff-status ${s.status}`}>
                    {s.status === 'active'
                      ? `Clocked In · ${new Date(s.lastIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : 'Not Clocked In'}
                  </div>
                </div>
                <button
                  className={`pos-btn-clock ${s.status === 'active' ? 'out' : 'in'}`}
                  disabled={loading === s.id}
                  onClick={() => handle(s.id, s.status === 'active')}
                >
                  {loading === s.id
                    ? <Loader2 size={14} className="spin" />
                    : s.status === 'active'
                      ? <><LogOut size={14} /> CLOCK OUT</>
                      : <><LogIn size={14} /> CLOCK IN</>}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Check-In Screen ──────────────────────────────────────────────
function CheckInScreen({ onSelectAppointment, onSelectTech, onNewWalkin, onNavigate, onOpenClock }) {
  const { appointments, technicians, clockStatus, companyInfo } = useApp();

  const today = new Date().toISOString().split('T')[0];
  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const todayApts = useMemo(() =>
    appointments
      .filter(a => a.date === today && a.status !== 'cancelled' && a.status !== 'completed')
      .sort((a, b) => (a.time || '').localeCompare(b.time || '')),
    [appointments, today]
  );

  const clockedInIds = useMemo(() =>
    new Set(clockStatus.filter(s => s.status === 'active').map(s => s.id)),
    [clockStatus]
  );

  const availableTechs = useMemo(() =>
    technicians.filter(t => clockedInIds.has(t.id)),
    [technicians, clockedInIds]
  );

  return (
    <div className="pos-checkin">
      <button className="pos-mobile-back" onClick={() => onNavigate('calendar')}>
        <ChevronLeft size={15} /> Calendar
      </button>
      {/* Header */}
      <div className="pos-checkin-header">
        <div className="pos-brand">
          <img src="/logo.png" alt="Logo" className="pos-logo" onError={e => { e.target.style.display = 'none'; }} />
          <div className="pos-brand-text">
            <h1>{companyInfo.name}</h1>
            <p>{companyInfo.address}</p>
          </div>
        </div>
        <span className="pos-checkin-date">{dateLabel}</span>
        <button className="pos-clock-label-btn" onClick={onOpenClock}>
          <Clock size={15} /> Timeclock
        </button>
      </div>

      {/* Two-panel body */}
      <div className="pos-checkin-body">

        {/* Left: Waiting List */}
        <div className="pos-waiting-panel">
          <div className="pos-panel-header">
            <span className="pos-panel-title"><UserCheck size={15} /> WAITING LIST</span>
            <span className="pos-item-count">{todayApts.length}</span>
          </div>
          <div className="pos-waiting-scroll">
            <button className="pos-walkin-btn" onClick={onNewWalkin}>
              <Plus size={16} /> New Walk-In
            </button>
            {todayApts.length === 0 ? (
              <div className="pos-empty-state" style={{ marginTop: '2rem' }}>No appointments today</div>
            ) : (
              todayApts.map(apt => {
                const tech = technicians.find(t => t.id === apt.technicianId);
                return (
                  <div key={apt.id} className="pos-waiting-card" onClick={() => onSelectAppointment(apt)}>
                    <div className="pos-waiting-card-top">
                      <span className="pos-waiting-name">{apt.clientName}</span>
                      <span className="pos-waiting-time">{formatTime(apt.time)}</span>
                    </div>
                    <div className="pos-waiting-card-bottom">
                      <span className="pos-waiting-service">{apt.service}</span>
                      {tech && <span className="pos-waiting-tech">with {tech.name}</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Available Techs */}
        <div className="pos-techs-panel">
          <div className="pos-panel-header">
            <span className="pos-panel-title"><User size={15} /> AVAILABLE TECHS</span>
            <span className="pos-item-count">{availableTechs.length}</span>
          </div>
          <div className="pos-techs-scroll">
            {availableTechs.length === 0 ? (
              <div className="pos-empty-state" style={{ marginTop: '2rem' }}>No techs clocked in</div>
            ) : (
              <div className="pos-tech-cards">
                {availableTechs.map(tech => (
                  <div key={tech.id} className="pos-tech-card" onClick={() => onSelectTech(tech)}>
                    <div className="pos-tech-avatar" style={{ background: tech.color || '#438e8e' }}>
                      {tech.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="pos-tech-name">{tech.name.split(' ')[0]}</div>
                    <div className="pos-tech-status">Available</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="pos-checkin-footer">
        <button className="pos-footer-btn" onClick={() => onNavigate('calendar')}>
          <ChevronLeft size={15} /> Back to Calendar
        </button>
        <div className="pos-footer-status">System Online · {companyInfo.name}</div>
      </div>
    </div>
  );
}

// ── Main POS Page ─────────────────────────────────────────────────
export default function POSPage({ onNavigate }) {
  const { technicians, clients, companyInfo, clockStatus } = useApp();

  // ── Mode ───────────────────────────────────────────────────────
  const [mode, setMode] = useState('checkin'); // 'checkin' | 'checkout'

  // ── Checkout state ─────────────────────────────────────────────
  const [services, setServices] = useState([]);
  const [activeCat, setActiveCat] = useState('all');
  const [ticket, setTicket] = useState([]);
  const [selectedTech, setSelectedTech] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isClockOpen, setIsClockOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => setToast({ message, type });

  useEffect(() => {
    api.get('/pos/services').then(d => setServices(d.services || [])).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedTech && technicians.length > 0) {
      const active = technicians.find(t => clockStatus.find(s => s.id === t.id && s.status === 'active'));
      setSelectedTech(active || technicians[0]);
    }
  }, [technicians, clockStatus, selectedTech]);

  // ── Navigate from check-in → checkout ─────────────────────────
  function goCheckout(client = null, tech = null) {
    if (client) setSelectedClient(client);
    if (tech) setSelectedTech(tech);
    setMode('checkout');
  }

  function handleSelectAppointment(apt) {
    const client = clients.find(c => c.id === apt.clientId) || { name: apt.clientName, id: null, phone: '' };
    const tech = technicians.find(t => t.id === apt.technicianId) || null;
    goCheckout(client, tech);
  }

  // ── Services ───────────────────────────────────────────────────
  const categorizedServices = useMemo(() => services.map(s => {
    const n = s.name.toLowerCase();
    let cat = 'addons';
    if (n.includes('manicure') || n.includes('mani')) cat = 'mani';
    if (n.includes('pedicure') || n.includes('pedi')) cat = 'pedi';
    if (n.includes('acrylic')) cat = 'acrylic';
    if (n.includes('dip')) cat = 'dip';
    if (n.includes('builder') || n.includes('gel full') || n.includes('gel fill')) cat = 'gel';
    if (n.includes('kids')) cat = 'kids';
    return { ...s, cat };
  }), [services]);

  const filteredServices = useMemo(() =>
    activeCat === 'all' ? categorizedServices : categorizedServices.filter(s => s.cat === activeCat),
    [categorizedServices, activeCat]
  );

  const filteredClients = useMemo(() => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    return clients.filter(c =>
      c.name.toLowerCase().includes(q) || c.phone.includes(q)
    ).slice(0, 8);
  }, [clients, searchQuery]);

  // ── Totals ─────────────────────────────────────────────────────
  const subtotal = ticket.reduce((s, i) => s + i.price, 0);
  const serviceFee = paymentMethod === 'card' ? subtotal * 0.025 : 0;
  const grandTotal = subtotal + serviceFee;

  // ── Ticket actions ─────────────────────────────────────────────
  const addToTicket = svc => setTicket(prev => [...prev, {
    ...svc, ticketId: Date.now(), tech: selectedTech?.name || 'Staff', techId: selectedTech?.id,
  }]);
  const removeFromTicket = id => setTicket(prev => prev.filter(i => i.ticketId !== id));

  const handleCheckout = async () => {
    if (!ticket.length) return;
    setCheckoutLoading(true);
    try {
      await api.post('/pos/transactions', {
        clientId: selectedClient?.id || null,
        clientName: selectedClient?.name || 'Walk-in',
        clientPhone: selectedClient?.phone || '',
        date: new Date().toISOString().split('T')[0],
        subtotal, tax: 0, tip: 0, discount: 0, total: grandTotal, paymentMethod,
        lineItems: ticket.map(i => ({ technicianId: i.techId, service: i.name, price: i.price, quantity: 1 })),
      });
      showToast(`Transaction Complete · $${grandTotal.toFixed(2)}`, 'success');
      setTicket([]);
      setSelectedClient(null);
      setMode('checkin');
    } catch { showToast('Checkout failed', 'error'); }
    finally { setCheckoutLoading(false); }
  };

  // ── Check-In Screen ───────────────────────────────────────────
  if (mode === 'checkin') {
    return (
      <>
        {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
        {isClockOpen && <TimeclockPanel onClose={() => setIsClockOpen(false)} />}
        <CheckInScreen
          onSelectAppointment={handleSelectAppointment}
          onSelectTech={tech => goCheckout(null, tech)}
          onNewWalkin={() => goCheckout(null, null)}
          onNavigate={onNavigate}
          onOpenClock={() => setIsClockOpen(true)}
        />
      </>
    );
  }

  // ── Checkout Screen ───────────────────────────────────────────
  return (
    <div className="pos-container">
      <button className="pos-mobile-back" onClick={() => setMode('checkin')}>
        <ChevronLeft size={15} /> Back
      </button>
      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}

      {/* Sidebar: Ticket */}
      <aside className="pos-sidebar">
        <div className="pos-sidebar-header">
          <div className="pos-brand">
            <img src="/logo.png" alt="Logo" className="pos-logo" onError={e => { e.target.style.display = 'none'; }} />
            <div className="pos-brand-text">
              <h1>{companyInfo.name}</h1>
              <p>{companyInfo.address}</p>
            </div>
          </div>
        </div>

        <div className="pos-client-section">
          <button className="pos-client-btn" onClick={() => setIsSearchOpen(true)}>
            <User size={16} />
            <span>{selectedClient ? selectedClient.name : 'Select Client...'}</span>
            <Search size={14} style={{ marginLeft: 'auto', opacity: 0.5 }} />
          </button>
          {selectedClient && (
            <button className="pos-client-clear" onClick={() => setSelectedClient(null)}>×</button>
          )}
        </div>

        <div className="pos-ticket-area">
          <div className="pos-ticket-header">
            <ShoppingCart size={14} /> <span>TICKET</span>
            <span className="pos-item-count">{ticket.length} items</span>
          </div>
          <div className="pos-ticket-items">
            {ticket.length === 0
              ? <div className="pos-empty-state">Ticket is empty</div>
              : ticket.map(item => (
                <div key={item.ticketId} className="pos-ticket-item">
                  <div className="pos-item-main">
                    <span className="pos-item-name">{item.name}</span>
                    <span className="pos-item-tech">with {item.tech}</span>
                  </div>
                  <span className="pos-item-price">${item.price.toFixed(2)}</span>
                  <button className="pos-item-remove" onClick={() => removeFromTicket(item.ticketId)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
          </div>
        </div>

        <div className="pos-summary">
          <div className="pos-summary-row"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
          {paymentMethod === 'card' && (
            <div className="pos-summary-row fee">
              <span>Card Fee (2.5%)</span><span>${serviceFee.toFixed(2)}</span>
            </div>
          )}
          <div className="pos-total"><span>Total</span><span>${grandTotal.toFixed(2)}</span></div>
          <div className="pos-payment-methods">
            <button className={`pos-pay-method ${paymentMethod === 'cash' ? 'active' : ''}`} onClick={() => setPaymentMethod('cash')}>
              <Banknote size={15} /> Cash
            </button>
            <button className={`pos-pay-method ${paymentMethod === 'card' ? 'active' : ''}`} onClick={() => setPaymentMethod('card')}>
              <CreditCard size={15} /> Card +2.5%
            </button>
          </div>
          <button className="pos-btn-pay" disabled={!ticket.length || checkoutLoading} onClick={handleCheckout}>
            {checkoutLoading ? <Loader2 className="spin" /> : <><Receipt size={17} /> CHARGE ${grandTotal.toFixed(2)}</>}
          </button>
        </div>
      </aside>

      {/* Main: Catalog */}
      <main className="pos-main">
        <header className="pos-header">
          <nav className="pos-nav">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                className={`pos-nav-item${activeCat === cat.id ? ' active' : ''}`}
                onClick={() => setActiveCat(cat.id)}
              >
                {cat.icon} <span>{cat.name}</span>
              </button>
            ))}
          </nav>
          <div className="pos-header-actions">
            <div className="pos-tech-select-wrapper">
              <span className="pos-label">Tech:</span>
              <select
                className="pos-select"
                value={selectedTech?.id || ''}
                onChange={e => setSelectedTech(technicians.find(t => t.id === parseInt(e.target.value)))}
              >
                {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <button className="pos-btn-clock-header" onClick={() => setIsClockOpen(true)}><Clock size={16} /></button>
          </div>
        </header>

        <div className="pos-grid">
          {filteredServices.map(svc => (
            <button key={svc.name} className="pos-card" onClick={() => addToTicket(svc)}>
              <span className="pos-card-name">{svc.name}</span>
              <span className="pos-card-price">{svc.priceStr || `$${svc.price}`}</span>
            </button>
          ))}
        </div>

        <footer className="pos-footer">
          <button className="pos-footer-btn" onClick={() => setMode('checkin')}>
            <ChevronLeft size={15} /> Back to Check-In
          </button>
          <div className="pos-footer-status">System Online</div>
        </footer>
      </main>

      {/* Client search modal */}
      {isSearchOpen && (
        <div className="pos-overlay">
          <div className="pos-modal">
            <div className="pos-modal-header">
              <h2 className="pos-modal-title">Select Client</h2>
              <button className="pos-btn-icon" onClick={() => setIsSearchOpen(false)}>×</button>
            </div>
            <div className="pos-modal-body">
              <div className="pos-search-box">
                <Search size={18} />
                <input
                  autoFocus
                  placeholder="Search name or phone..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="pos-results">
                <button className="pos-result-item walkin" onClick={() => { setSelectedClient(null); setIsSearchOpen(false); }}>
                  <strong>Walk-In Customer</strong>
                </button>
                {filteredClients.map(c => (
                  <button key={c.id} className="pos-result-item" onClick={() => { setSelectedClient(c); setIsSearchOpen(false); }}>
                    <strong>{c.name}</strong><span>{c.phone}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {isClockOpen && <TimeclockPanel onClose={() => setIsClockOpen(false)} />}
    </div>
  );
}
