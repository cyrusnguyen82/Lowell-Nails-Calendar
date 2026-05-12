import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  User, Trash2, ShoppingCart, HandMetal, Waves, Sparkles, 
  Tag, Clock, LogIn, LogOut, AlertCircle, CheckCircle2, Loader2,
  ChevronLeft, Search, Receipt, CreditCard, Banknote, Split
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import * as api from '../../api';
import './POS.css';

const CATEGORIES = [
  { id: 'all',     name: 'All',          icon: <ShoppingCart size={14} /> },
  { id: 'mani',    name: 'Manicure',     icon: <HandMetal size={14} /> },
  { id: 'pedi',    name: 'Pedicure',     icon: <Waves size={14} /> },
  { id: 'acrylic', name: 'Acrylic',      icon: <Sparkles size={14} /> },
  { id: 'dip',     name: 'Dipping',      icon: <Sparkles size={14} /> },
  { id: 'gel',     name: 'Builder Gel',  icon: <Sparkles size={14} /> },
  { id: 'kids',    name: 'Kids',         icon: <User size={14} /> },
  { id: 'addons',  name: 'Add-Ons',      icon: <Tag size={14} /> },
];

// ── Toast Component ───────────────────────────────────────────────────────────
function Toast({ message, type = 'success', onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div className={`toast-alert toast-${type}`} onClick={onDismiss}>
      {type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
      <span>{message}</span>
    </div>
  );
}

// ── Timeclock Panel Component ─────────────────────────────────────────────────
function TimeclockPanel({ onClose }) {
  const { clockStatus, clockIn, clockOut } = useApp();
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast] = useState(null);

  const handleClock = async (techId, isClockedIn) => {
    setActionLoading(techId);
    try {
      if (isClockedIn) {
        const res = await clockOut(techId);
        setToast({ message: `Clocked out. Total hours: ${res.hours}`, type: 'success' });
      } else {
        await clockIn(techId);
        setToast({ message: 'Clocked in successfully', type: 'success' });
      }
    } catch (e) {
      setToast({ message: 'Action failed', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="pos-overlay">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
      <div className="pos-modal">
        <div className="pos-modal-header">
          <h2 className="pos-modal-title">
            <Clock size={18} /> STAFF TIMECLOCK
          </h2>
          <button className="pos-btn-icon" onClick={onClose}>×</button>
        </div>

        <div className="pos-modal-body">
          <div className="pos-staff-list">
            {clockStatus.map(staff => (
              <div key={staff.id} className="pos-staff-row">
                <div className="pos-staff-info">
                  <div className="pos-staff-name">{staff.name}</div>
                  <div className={`pos-staff-status ${staff.status}`}>
                    {staff.status === 'active' 
                      ? `Clocked In · ${new Date(staff.lastIn).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` 
                      : 'Not Clocked In'}
                  </div>
                </div>
                <button
                  className={`pos-btn-clock ${staff.status === 'active' ? 'out' : 'in'}`}
                  disabled={actionLoading === staff.id}
                  onClick={() => handleClock(staff.id, staff.status === 'active')}
                >
                  {actionLoading === staff.id
                    ? <Loader2 size={14} className="spin" />
                    : staff.status === 'active' ? <><LogOut size={14} /> CLOCK OUT</> : <><LogIn size={14} /> CLOCK IN</>}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main POS Page ─────────────────────────────────────────────────────────────
export default function POSPage({ onNavigate }) {
  const { technicians, clients, companyInfo, clockStatus } = useApp();
  
  // State
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
  
  const [editingId, setEditingId] = useState(null);
  const [tempPrice, setTempPrice] = useState('');

  const showToast = (message, type = 'success') => setToast({ message, type });

  // Fetch services on mount
  useEffect(() => {
    api.get('/pos/services').then(data => {
      setServices(data.services || []);
    }).catch(console.error);
  }, []);

  // Set default tech to first clocked-in tech if available
  useEffect(() => {
    if (!selectedTech && technicians.length > 0) {
      const activeTech = technicians.find(t => clockStatus.find(s => s.id === t.id && s.status === 'active'));
      setSelectedTech(activeTech || technicians[0]);
    }
  }, [technicians, clockStatus, selectedTech]);

  // Keyword-based categorization
  const categoriedServices = useMemo(() => {
    return services.map(s => {
      const name = s.name.toLowerCase();
      let cat = 'addons';
      if (name.includes('manicure') || name.includes('mani')) cat = 'mani';
      if (name.includes('pedicure') || name.includes('pedi')) cat = 'pedi';
      if (name.includes('acrylic')) cat = 'acrylic';
      if (name.includes('dip')) cat = 'dip';
      if (name.includes('builder') || name.includes('gel full') || name.includes('gel fill')) cat = 'gel';
      if (name.includes('kids')) cat = 'kids';
      return { ...s, cat };
    });
  }, [services]);

  const filteredServices = useMemo(() => {
    if (activeCat === 'all') return categoriedServices;
    return categoriedServices.filter(s => s.cat === activeCat);
  }, [categoriedServices, activeCat]);

  const filteredClients = useMemo(() => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    return clients.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.phone.includes(q)
    ).slice(0, 8);
  }, [clients, searchQuery]);

  // Totals
  const subtotal = ticket.reduce((acc, curr) => acc + curr.price, 0);
  const serviceFee = paymentMethod === 'card' ? subtotal * 0.025 : 0;
  const grandTotal = subtotal + serviceFee;

  // Actions
  const addToTicket = (service) => {
    setTicket(prev => [...prev, {
      ...service,
      ticketId: Date.now(),
      tech: selectedTech?.name || 'Staff',
      techId: selectedTech?.id,
    }]);
  };

  const removeFromTicket = (ticketId) => setTicket(prev => prev.filter(i => i.ticketId !== ticketId));

  const handleCheckout = async () => {
    if (ticket.length === 0) return;
    setCheckoutLoading(true);
    try {
      const payload = {
        clientId: selectedClient?.id || null,
        clientName: selectedClient?.name || 'Walk-in',
        clientPhone: selectedClient?.phone || '',
        date: new Date().toISOString().split('T')[0],
        subtotal,
        tax: 0, // Simplified for now
        tip: 0,
        discount: 0,
        total: grandTotal,
        paymentMethod,
        lineItems: ticket.map(item => ({
          technicianId: item.techId,
          service: item.name,
          price: item.price,
          quantity: 1
        }))
      };
      await api.post('/pos/transactions', payload);
      showToast(`Transaction Complete: $${grandTotal.toFixed(2)}`, 'success');
      setTicket([]);
      setSelectedClient(null);
    } catch (e) {
      showToast('Checkout failed', 'error');
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="pos-container">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
      
      {/* Sidebar: Ticket */}
      <aside className="pos-sidebar">
        <div className="pos-sidebar-header">
          <div className="pos-brand">
            <img src="/logo.png" alt="Logo" className="pos-logo" />
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
            {ticket.length === 0 ? (
              <div className="pos-empty-state">Ticket is empty</div>
            ) : (
              ticket.map(item => (
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
              ))
            )}
          </div>
        </div>

        <div className="pos-summary">
          <div className="pos-summary-row">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          {paymentMethod === 'card' && (
            <div className="pos-summary-row fee">
              <span>Card Service Fee (2.5%)</span>
              <span>${serviceFee.toFixed(2)}</span>
            </div>
          )}
          <div className="pos-total">
            <span>Total</span>
            <span>${grandTotal.toFixed(2)}</span>
          </div>

          <div className="pos-payment-methods">
            <button 
              className={`pos-pay-method ${paymentMethod === 'cash' ? 'active' : ''}`}
              onClick={() => setPaymentMethod('cash')}
            >
              <Banknote size={16} /> <span>Cash (0%)</span>
            </button>
            <button 
              className={`pos-pay-method ${paymentMethod === 'card' ? 'active' : ''}`}
              onClick={() => setPaymentMethod('card')}
            >
              <CreditCard size={16} /> <span>Card (2.5%)</span>
            </button>
          </div>

          <button 
            className="pos-btn-pay" 
            disabled={ticket.length === 0 || checkoutLoading}
            onClick={handleCheckout}
          >
            {checkoutLoading ? <Loader2 className="spin" /> : <><Receipt size={18} /> CHARGE ${grandTotal.toFixed(2)}</>}
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
                className={`pos-nav-item ${activeCat === cat.id ? 'active' : ''}`}
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
                onChange={(e) => setSelectedTech(technicians.find(t => t.id === parseInt(e.target.value)))}
               >
                 {technicians.map(t => (
                   <option key={t.id} value={t.id}>{t.name}</option>
                 ))}
               </select>
             </div>
             <button className="pos-btn-clock-header" onClick={() => setIsClockOpen(true)}>
               <Clock size={16} />
             </button>
          </div>
        </header>

        <div className="pos-grid">
          {filteredServices.map(service => (
            <button key={service.name} className="pos-card" onClick={() => addToTicket(service)}>
              <span className="pos-card-name">{service.name}</span>
              <span className="pos-card-price">{service.priceStr || `$${service.price}`}</span>
            </button>
          ))}
        </div>

        <footer className="pos-footer">
           <button className="pos-footer-btn" onClick={() => onNavigate('calendar')}>
             <ChevronLeft size={16} /> Back to Calendar
           </button>
           <div className="pos-footer-status">
              System Online · Connected to Lowell Nails Backend
           </div>
        </footer>
      </main>

      {/* Modals */}
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
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="pos-results">
                 <button className="pos-result-item walkin" onClick={() => { setSelectedClient(null); setIsSearchOpen(false); }}>
                    <strong>Walk-In Customer</strong>
                 </button>
                 {filteredClients.map(c => (
                   <button key={c.id} className="pos-result-item" onClick={() => { setSelectedClient(c); setIsSearchOpen(false); }}>
                      <strong>{c.name}</strong>
                      <span>{c.phone}</span>
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
