import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, TrendingUp, Users, PlayCircle, FileText, Wallet } from 'lucide-react';
import logo from './assets/logo_transparent.png';

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/financial', icon: TrendingUp, label: 'Financial' },
];

const PAYROLL_NAV = [
  { to: '/payroll', icon: Wallet, label: 'Overview' },
  { to: '/payroll/employees', icon: Users, label: 'Employees' },
  { to: '/payroll/run', icon: PlayCircle, label: 'Run Payroll' },
  { to: '/payroll/reports', icon: FileText, label: 'Tax Reports' },
];

export default function Sidebar({ me, onLogout }) {
  const location = useLocation();
  const inPayroll = location.pathname.startsWith('/payroll');

  return (
    <nav className="admin-sidebar">
      <div className="sidebar-header">
        <img src={logo} alt="Logo" className="sidebar-logo" />
        <span className="sidebar-brand">Financial</span>
      </div>
      <ul className="sidebar-nav">
        {NAV.map(({ to, icon: Icon, label }) => (
          <li key={to}>
            <NavLink to={to} end className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
        <div className="sidebar-divider" />
        <li>
          <NavLink to="/payroll" end className={() => `sidebar-link${inPayroll ? ' active' : ''}`}>
            <Wallet size={18} />
            <span>Payroll</span>
          </NavLink>
        </li>
        {inPayroll && (
          <ul className="sidebar-sub">
            {PAYROLL_NAV.map(({ to, icon: Icon, label }) => (
              <li key={to}>
                <NavLink to={to} end className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
                  <Icon size={15} />
                  <span>{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </ul>
      <div className="sidebar-user">
        <span>{me.username}</span>
        <button onClick={onLogout}>Log out</button>
      </div>
    </nav>
  );
}
