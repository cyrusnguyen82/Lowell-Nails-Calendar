import { useState, useEffect } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import LoginScreen from './components/Auth/LoginScreen'
import Sidebar from './components/Layout/Sidebar'
import CalendarPage from './components/Calendar/CalendarPage'
import ClientsPage from './components/Clients/ClientsPage'
import AdminPage from './components/Admin/AdminPage'
import POSPage from './components/POS/POSPage'
import BookingPage from './components/Booking/BookingPage'
import BookingCancel from './components/Booking/BookingCancel'
import './components/Layout/Layout.css'

const ACCESS = {
  calendar:  ['admin','receptionist','technician'],
  clients:   ['admin','receptionist'],
  pos:       ['admin','receptionist'],
  admin:     ['admin','receptionist'],
}

const PAGE_KEY     = 'lowell_nails_page'
const CAL_DATE_KEY = 'lowell_cal_date'
const CAL_VIEW_KEY = 'lowell_cal_view'

/* ── Loading screen ───────────────────────────────────────────── */
function Loader() {
  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--slate-900)', flexDirection: 'column', gap: 16,
    }}>
      <div style={{
        width: 36, height: 36,
        border: '3px solid rgba(255,255,255,0.08)',
        borderTopColor: 'var(--brand)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <p style={{ color: 'var(--slate-500)', fontSize: 13 }}>Connecting…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

/* ── Error screen ─────────────────────────────────────────────── */
function ErrorScreen() {
  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--slate-900)', flexDirection: 'column', gap: 12, padding: 24, textAlign: 'center',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%', background: 'rgba(239,68,68,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4,
      }}>
        <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="#ef4444" strokeWidth="1.8">
          <circle cx="10" cy="10" r="8"/>
          <path d="M10 6v4M10 14h.01" strokeLinecap="round"/>
        </svg>
      </div>
      <p style={{ color: '#f87171', fontSize: 15, fontWeight: 700 }}>Cannot connect to server</p>
      {import.meta.env.DEV ? (
        <>
          <p style={{ color: 'var(--slate-500)', fontSize: 13 }}>Make sure the backend is running on port 3000</p>
          <code style={{ color: 'var(--slate-400)', fontSize: 12, background: 'var(--slate-800)', padding: '6px 14px', borderRadius: 6 }}>
            cd michael-receptionist &amp;&amp; npm start
          </code>
        </>
      ) : (
        <p style={{ color: 'var(--slate-500)', fontSize: 13 }}>
          {import.meta.env.VITE_API_URL
            ? <>Trying to reach: <code style={{ color: 'var(--slate-400)' }}>{import.meta.env.VITE_API_URL}</code></>
            : <><code style={{ color: 'var(--amber)' }}>VITE_API_URL</code> is not set — add it to your environment variables.</>
          }
        </p>
      )}
      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop: 8, padding: '9px 24px', background: 'var(--accent)',
          color: '#fff', border: 'none', borderRadius: 'var(--r)',
          cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
        }}
      >
        Retry
      </button>
    </div>
  )
}

const THEME_KEY   = 'lowell_theme'
const SIDEBAR_KEY = 'lowell_sidebar'

/* ── Shell ────────────────────────────────────────────────────── */
function Shell() {
  const { user, loading, apiError } = useApp()
  const [page, setPage] = useState(() => {
    try { return sessionStorage.getItem(PAGE_KEY) || 'calendar' } catch { return 'calendar' }
  })
  const [sidebarHidden, setSidebarHidden] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === 'hidden' } catch { return false }
  })

  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY) || 'polar'
      document.documentElement.setAttribute('data-theme', saved)
    } catch {}
  }, [])

  function toggleSidebar() {
    setSidebarHidden(h => {
      const next = !h
      try { localStorage.setItem(SIDEBAR_KEY, next ? 'hidden' : 'visible') } catch {}
      return next
    })
  }

  const [calDateStr, setCalDateStr] = useState(() => {
    try { return localStorage.getItem(CAL_DATE_KEY) || '' } catch { return '' }
  })
  const [calView, setCalView] = useState(() => {
    try { return localStorage.getItem(CAL_VIEW_KEY) || 'day' } catch { return 'day' }
  })
  useEffect(() => {
    if (calDateStr) try { localStorage.setItem(CAL_DATE_KEY, calDateStr) } catch {}
  }, [calDateStr])
  useEffect(() => {
    try { localStorage.setItem(CAL_VIEW_KEY, calView) } catch {}
  }, [calView])

  if (loading)   return <Loader />
  if (apiError)  return <ErrorScreen />
  if (!user)     return <LoginScreen />

  function navigate(p) {
    if (ACCESS[p]?.includes(user.role)) {
      setPage(p)
      try { sessionStorage.setItem(PAGE_KEY, p) } catch {}
    }
  }

  const safePage = ACCESS[page]?.includes(user.role) ? page : 'calendar'

  /* POS is full-screen — no sidebar */
  if (safePage === 'pos') {
    return <POSPage onNavigate={navigate} />
  }

  return (
    <div className="app-shell">
      {!sidebarHidden && <Sidebar page={safePage} onNavigate={navigate} onHide={toggleSidebar} />}
      {sidebarHidden && (
        <button className="sidebar-show-btn" onClick={toggleSidebar} title="Show sidebar">›</button>
      )}
      <main className="app-main">
        {safePage === 'calendar'  && (
          <CalendarPage
            initDateStr={calDateStr} initView={calView}
            onDateChange={setCalDateStr} onViewChange={setCalView}
            onNavigate={navigate}
          />
        )}
        {safePage === 'clients'   && <ClientsPage />}
        {safePage === 'admin'     && <AdminPage />}
      </main>
    </div>
  )
}

export default function App() {
  const path = window.location.pathname
  if (path === '/book' || path === '/book/') return <BookingPage />
  if (path.startsWith('/book/cancel/')) {
    const token = path.replace('/book/cancel/', '').replace(/\/$/, '')
    return <BookingCancel token={token} />
  }
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
