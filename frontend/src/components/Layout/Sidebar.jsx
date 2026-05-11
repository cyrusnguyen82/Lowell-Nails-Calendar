import { useApp } from '../../context/AppContext'
import './Layout.css'

const NAV = [
  { id: 'calendar',  label: 'Calendar',   icon: '📅', roles: ['admin','receptionist','technician'] },
  { id: 'clients',   label: 'Clients',    icon: '👥', roles: ['admin','receptionist'] },
  { id: 'pos',       label: 'POS',        icon: '🖥',  roles: ['admin','receptionist'] },
  { id: 'admin',     label: 'Admin',      icon: '⚙️', roles: ['admin','receptionist'] },
]

const ROLE_BADGE = {
  admin:        { label: 'Admin',        bg: '#3ab592' },
  receptionist: { label: 'Receptionist', bg: '#3a82c4' },
  technician:   { label: 'Technician',   bg: '#10b981' },
}

/* ── Lowell Nails logo ─────────────────────────────────────── */
function SalonLogo() {
  return (
    <img src="/logo.png" alt="Lowell Nails and Spa" style={{ width: 64, height: 64, objectFit: 'contain' }} />
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
