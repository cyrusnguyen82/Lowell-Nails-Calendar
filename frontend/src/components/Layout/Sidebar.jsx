import { useApp } from '../../context/AppContext'
import './Layout.css'

const NAV = [
  { id: 'calendar',  label: 'Calendar',   icon: '📅', roles: ['admin','receptionist','technician'] },
  { id: 'clients',   label: 'Clients',    icon: '👥', roles: ['admin','receptionist'] },
  { id: 'giftcards', label: 'Gift Cards', icon: '🎁', roles: ['admin','receptionist'] },
  { id: 'pos',       label: 'POS',        icon: '🖥',  roles: ['admin','receptionist'] },
  { id: 'admin',     label: 'Admin',      icon: '⚙️', roles: ['admin'] },
]

const ROLE_BADGE = {
  admin:        { label: 'Admin',        bg: '#3ab592' },
  receptionist: { label: 'Receptionist', bg: '#3a82c4' },
  technician:   { label: 'Technician',   bg: '#10b981' },
}

/* ── Lowell Nails SVG logo ─────────────────────────────────── */
function SalonLogo() {
  return (
    <svg viewBox="0 0 56 56" width="56" height="56" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lnGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3ab592" />
          <stop offset="100%" stopColor="#3a82c4" />
        </linearGradient>
        <linearGradient id="lnGrad2" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#3ab592" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#3a82c4" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {/* Background */}
      <rect width="56" height="56" rx="12" fill="url(#lnGrad)" />
      {/* Three fingernail shapes — the classic nail salon icon */}
      <ellipse cx="18" cy="32" rx="5" ry="8"  fill="white" opacity="0.75" />
      <ellipse cx="28" cy="26" rx="5.5" ry="10" fill="white" />
      <ellipse cx="38" cy="32" rx="5" ry="8"  fill="white" opacity="0.75" />
      {/* Shine highlights */}
      <ellipse cx="26" cy="20" rx="1.5" ry="2" fill="white" opacity="0.45" />
      {/* Bottom bar accent */}
      <rect x="12" y="43" width="32" height="3" rx="1.5" fill="white" opacity="0.3" />
    </svg>
  )
}

export default function Sidebar({ page, onNavigate }) {
  const { user, logout } = useApp()
  const badge   = ROLE_BADGE[user.role]
  const allowed = NAV.filter(n => n.roles.includes(user.role))

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <SalonLogo />
        <div className="sidebar-brand-name">LOWELL NAILS<br />&amp; SPA</div>
      </div>

      <nav className="sidebar-nav">
        {allowed.map(item => (
          <button
            key={item.id}
            className={`sidebar-nav-item${page === item.id ? ' active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{user.initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user.name}</div>
            <div className="sidebar-role-badge" style={{ background: badge.bg }}>{badge.label}</div>
          </div>
        </div>
        <button className="sidebar-logout" onClick={logout}>Sign out</button>
      </div>
    </aside>
  )
}
