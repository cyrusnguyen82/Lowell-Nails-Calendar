import { useState } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import LoginScreen from './components/Auth/LoginScreen'
import Sidebar from './components/Layout/Sidebar'
import CalendarPage from './components/Calendar/CalendarPage'
import ClientsPage from './components/Clients/ClientsPage'
import GiftCardsPage from './components/GiftCards/GiftCardsPage'
import AdminPage from './components/Admin/AdminPage'
import './components/Layout/Layout.css'

const ACCESS = {
  calendar:  ['admin','receptionist','technician'],
  clients:   ['admin','receptionist'],
  giftcards: ['admin','receptionist'],
  admin:     ['admin'],
}

function Shell() {
  const { user, loading, apiError } = useApp()
  const [page, setPage] = useState('calendar')

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
                  background:'#0f172a', flexDirection:'column', gap:12 }}>
      <p style={{ color:'#ef4444', fontSize:16, fontWeight:700 }}>Cannot connect to server</p>
      <p style={{ color:'#64748b', fontSize:13 }}>Make sure the backend is running on port 3000</p>
      <code style={{ color:'#94a3b8', fontSize:12, background:'#1e293b', padding:'6px 12px', borderRadius:6 }}>
        cd michael-receptionist &amp;&amp; npm start
      </code>
    </div>
  )

  if (!user) return <LoginScreen />

  function navigate(p) {
    if (ACCESS[p]?.includes(user.role)) setPage(p)
  }

  const safePage = ACCESS[page]?.includes(user.role) ? page : 'calendar'

  return (
    <div className="app-shell">
      <Sidebar page={safePage} onNavigate={navigate} />
      <main className="app-main">
        {safePage === 'calendar'  && <CalendarPage />}
        {safePage === 'clients'   && <ClientsPage />}
        {safePage === 'giftcards' && <GiftCardsPage />}
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
