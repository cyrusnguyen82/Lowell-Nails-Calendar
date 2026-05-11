import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import './Layout.css'

const NAV = [
  { id: 'calendar',  label: 'Calendar',   icon: '📅', roles: ['admin','receptionist','technician'] },
  { id: 'clients',   label: 'Clients',    icon: '👥', roles: ['admin','receptionist'] },
  { id: 'giftcards', label: 'Gift Cards', icon: '🎁', roles: ['admin','receptionist'] },
  { id: 'pos',       label: 'POS',        icon: '💲', roles: ['admin','receptionist'] },
  { id: 'admin',     label: 'Admin',      icon: '⚙️', roles: ['admin'] },
]

const ROLE_BADGE = {
  admin:        { label: 'Admin',        bg: '#4f46e5' },
  receptionist: { label: 'Receptionist', bg: '#0ea5e9' },
  technician:   { label: 'Technician',   bg: '#10b981' },
}

function SidebarLogo({ logoUrl, name }) {
  const [imgErr, setImgErr] = useState(false)

  return (
    <div className="sidebar-brand">
      {!imgErr && logoUrl ? (
        <img
          src={logoUrl}
          alt={name}
          className="sidebar-logo-img"
          onError={() => setImgErr(true)}
        />
      ) : (
        <div className="sidebar-logo-fallback">
          {name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase()}
        </div>
      )}
      <div className="sidebar-brand-name">{name}</div>
    </div>
  )
}

export default function Sidebar({ page, onNavigate }) {
  const { user, logout, companyInfo } = useApp()
  const badge   = ROLE_BADGE[user.role]
  const allowed = NAV.filter(n => n.roles.includes(user.role))

  return (
    <aside className="sidebar">
      <SidebarLogo logoUrl={companyInfo.logoUrl} name={companyInfo.name} />

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
