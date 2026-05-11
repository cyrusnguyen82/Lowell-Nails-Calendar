import { useApp } from '../../context/AppContext'
import './Layout.css'

const NAV = [
  { id: 'calendar', label: 'Calendar',  icon: '📅', roles: ['admin','receptionist','technician'] },
  { id: 'clients',  label: 'Clients',   icon: '👥', roles: ['admin','receptionist'] },
  { id: 'pos',      label: 'POS',       icon: '🖥',  roles: ['admin','receptionist'] },
  { id: 'admin',    label: 'Admin',     icon: '⚙️', roles: ['admin','receptionist'] },
]

const ROLE_BADGE = {
  admin:        { label: 'Admin',        bg: '#3ab592' },
  receptionist: { label: 'Receptionist', bg: '#3a82c4' },
  technician:   { label: 'Tech',         bg: '#10b981' },
}

export default function TopBar({ page, onNavigate }) {
  const { user, logout } = useApp()
  const badge   = ROLE_BADGE[user.role]
  const allowed = NAV.filter(n => n.roles.includes(user.role))

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <img src="/logo.png" alt="Lowell Nails" className="topbar-logo" />
        <span className="topbar-brand-name">LOWELL NAILS &amp; SPA</span>
      </div>

      <nav className="topbar-nav">
        {allowed.map(item => (
          <button
            key={item.id}
            className={`topbar-nav-btn${page === item.id ? ' active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="topbar-nav-icon">{item.icon}</span>
            <span className="topbar-nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="topbar-user">
        <div className="topbar-avatar">{user.initials}</div>
        <div className="topbar-user-info">
          <span className="topbar-user-name">{user.name}</span>
          <span className="topbar-role-badge" style={{ background: badge.bg }}>{badge.label}</span>
        </div>
        <button className="topbar-logout" onClick={logout}>Sign out</button>
      </div>
    </header>
  )
}
