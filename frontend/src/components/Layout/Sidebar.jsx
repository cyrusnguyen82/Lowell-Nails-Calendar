import { useApp } from '../../context/AppContext'
import './Layout.css'

/* ── SVG Icons ────────────────────────────────────────────────── */
const CalendarIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="14" height="14" rx="2.5"/>
    <path d="M7 2v4M13 2v4M3 9h14"/>
  </svg>
)
const ClientsIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 12c2.2.5 4 1.8 4 3.5V17H3v-1.5C3 13.8 4.8 12.5 7 12"/>
    <circle cx="10" cy="7" r="3.5"/>
  </svg>
)
const POSIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="16" height="12" rx="2"/>
    <path d="M2 9h16"/>
    <path d="M6 13h2M10 13h4"/>
  </svg>
)
const GiftIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9h14v9H3z"/>
    <path d="M1 6h18v3H1z"/>
    <path d="M10 6V18"/>
    <path d="M10 6c0-2 2-4 4-2s0 2-4 2z"/>
    <path d="M10 6c0-2-2-4-4-2s0 2 4 2z"/>
  </svg>
)
const AdminIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a3 3 0 100-6 3 3 0 000 6z"/>
    <path d="M17.7 10a7.7 7.7 0 00-.1-1.2l1.5-1.2-1.5-2.6-1.9.6a7.6 7.6 0 00-1-.6L14.5 3h-3l-.2 1.9a7.6 7.6 0 00-1 .6l-1.9-.6L7 7.5l1.5 1.3A7.7 7.7 0 008.3 10c0 .4 0 .8.1 1.2L6.9 12.4l1.5 2.6 1.9-.6c.3.2.7.4 1 .6l.2 2h3l.2-1.9a7.6 7.6 0 001-.6l1.9.6 1.5-2.6-1.5-1.2c.1-.4.1-.8.1-1.3z"/>
  </svg>
)
const SignOutIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 16H4a1 1 0 01-1-1V5a1 1 0 011-1h3"/>
    <path d="M13 13l4-3-4-3"/>
    <path d="M17 10H8"/>
  </svg>
)

/* ── Nav Definition ───────────────────────────────────────────── */
const NAV = [
  { id: 'calendar',  label: 'Calendar',     Icon: CalendarIcon, roles: ['admin','receptionist','technician'] },
  { id: 'clients',   label: 'Clients',      Icon: ClientsIcon,  roles: ['admin','receptionist'] },
  { id: 'pos',       label: 'Point of Sale',Icon: POSIcon,      roles: ['admin','receptionist'] },
  { id: 'admin',     label: 'Settings',     Icon: AdminIcon,    roles: ['admin','receptionist'] },
]

const ROLE_BADGE = {
  admin:        { label: 'Admin',        bg: '#6366f1' },
  receptionist: { label: 'Receptionist', bg: '#14b8a6' },
  technician:   { label: 'Technician',   bg: '#10b981' },
}

export default function Sidebar({ page, onNavigate }) {
  const { user, logout, companyInfo } = useApp()
  const badge   = ROLE_BADGE[user.role] || ROLE_BADGE.technician
  const allowed = NAV.filter(n => n.roles.includes(user.role))
  const logo    = companyInfo?.logoUrl || '/logo.png'

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <img src={logo} alt="logo" className="sidebar-logo" onError={e => { e.target.style.display='none' }} />
        <div className="sidebar-brand-name">
          {(companyInfo?.name || 'Lowell Nails & Spa').toUpperCase()}
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {allowed.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`sidebar-nav-item${page === id ? ' active' : ''}`}
            onClick={() => onNavigate(id)}
          >
            <span className="nav-icon"><Icon /></span>
            {label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{user.initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user.name}</div>
            <span className="sidebar-role-badge" style={{ background: badge.bg }}>{badge.label}</span>
          </div>
        </div>
        <button className="sidebar-logout" onClick={logout}>
          <span className="nav-icon" style={{ width:16, height:16 }}><SignOutIcon /></span>
          Sign out
        </button>
      </div>
    </aside>
  )
}
