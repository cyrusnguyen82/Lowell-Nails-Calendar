import { useState, useEffect } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import LoginScreen from './components/Auth/LoginScreen'
import TopBar from './components/Layout/TopBar'
import CalendarPage from './components/Calendar/CalendarPage'
import ClientsPage from './components/Clients/ClientsPage'
import GiftCardsPage from './components/GiftCards/GiftCardsPage'
import AdminPage from './components/Admin/AdminPage'
import POSPage from './components/POS/POSPage'
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

function Shell() {
  const { user, loading, apiError } = useApp()
  const [page, setPage] = useState(() => {
    try { return sessionStorage.getItem(PAGE_KEY) || 'calendar' } catch { return 'calendar' }
  })

  // Calendar state lives here so localStorage is read at Shell mount,
  // before loading/auth checks — CalendarPage only mounts later.
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

  if (loading) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
                  background:'#0f172a', flexDirection:'column', gap:16 }}>
      <div style={{ width:40, height:40, border:'4px solid #334155', borderTopColor:'#6366f1',
                    borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <p style={{ color:'#64748b', fontSize:14 }}>Connecting to database…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (apiError) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
                  background:'#0f172a', flexDirection:'column', gap:12, padding:24, textAlign:'center' }}>
      <p style={{ color:'#ef4444', fontSize:16, fontWeight:700 }}>Cannot connect to server</p>
      {import.meta.env.DEV ? (
        <>
          <p style={{ color:'#64748b', fontSize:13 }}>Make sure the backend is running on port 3000</p>
          <code style={{ color:'#94a3b8', fontSize:12, background:'#1e293b', padding:'6px 12px', borderRadius:6 }}>
            cd michael-receptionist &amp;&amp; npm start
          </code>
        </>
      ) : (
        <>
          <p style={{ color:'#64748b', fontSize:13 }}>
            {import.meta.env.VITE_API_URL
              ? <>Trying to reach: <code style={{ color:'#94a3b8' }}>{import.meta.env.VITE_API_URL}</code></>
              : <><code style={{ color:'#f59e0b' }}>VITE_API_URL</code> is not set — add it to your Render Static Site environment variables and redeploy.</>
            }
          </p>
        </>
      )}
      <button onClick={() => window.location.reload()}
        style={{ marginTop:8, padding:'8px 20px', background:'#4f46e5', color:'#fff',
                 border:'none', borderRadius:6, cursor:'pointer', fontSize:13, fontWeight:600 }}>
        Retry
      </button>
    </div>
  )

  if (!user) return <LoginScreen />

  function navigate(p) {
    if (ACCESS[p]?.includes(user.role)) {
      setPage(p)
      try { sessionStorage.setItem(PAGE_KEY, p) } catch {}
    }
  }

  const safePage = ACCESS[page]?.includes(user.role) ? page : 'calendar'

  return (
    <div className="app-shell">
      <TopBar page={safePage} onNavigate={navigate} />
      <main className="app-main">
        {safePage === 'calendar'  && <CalendarPage initDateStr={calDateStr} initView={calView} onDateChange={setCalDateStr} onViewChange={setCalView} />}
        {safePage === 'clients'   && <ClientsPage />}
        {safePage === 'giftcards' && <GiftCardsPage />}
        {safePage === 'pos'       && <POSPage onNavigate={navigate} />}
        {safePage === 'admin'     && <AdminPage />}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
