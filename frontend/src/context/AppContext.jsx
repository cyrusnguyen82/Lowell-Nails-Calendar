import { createContext, useContext, useState, useEffect } from 'react'
import * as api from '../api'
import { defaultCompanyInfo } from '../data/mockData'

const AppContext = createContext(null)

const SESSION_KEY      = 'lowell_nails_session'
const INACTIVITY_LIMIT = 30 * 60 * 1000  // 30 minutes

function getStoredUser() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const { user, lastActivity } = JSON.parse(raw)
    if (Date.now() - lastActivity < INACTIVITY_LIMIT) return user
    localStorage.removeItem(SESSION_KEY)
    return null
  } catch {
    return null
  }
}

export function AppProvider({ children }) {
  const [user, setUser]               = useState(getStoredUser)
  const [users, setUsers]             = useState([])
  const [technicians, setTechs]       = useState([])
  const [appointments, setApts]       = useState([])
  const [clients, setClients]         = useState([])
  const [giftCards, setGiftCards]     = useState([])
  const [companyInfo, setCompanyInfo] = useState(defaultCompanyInfo)
  const [loading, setLoading]         = useState(true)
  const [apiError, setApiError]       = useState(null)

  // ── Load all data on mount ─────────────────────────────────
  useEffect(() => {
    Promise.all([
      api.get('/technicians'),
      api.get('/appointments'),
      api.get('/clients'),
      api.get('/giftcards'),
      api.get('/users'),
    ]).then(([techs, apts, cls, gcs, usrs]) => {
      setTechs(techs)
      setApts(apts)
      setClients(cls)
      setGiftCards(gcs)
      setUsers(usrs)
      setLoading(false)
    }).catch(err => {
      console.error('API load failed:', err.message)
      setApiError(err.message)
      setLoading(false)
    })
  }, [])

  function updateCompanyInfo(updates) { setCompanyInfo(prev => ({ ...prev, ...updates })) }

  // ── Inactivity logout ──────────────────────────────────────
  useEffect(() => {
    if (!user) return
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click']
    function touch() {
      const raw = localStorage.getItem(SESSION_KEY)
      if (!raw) return
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ ...JSON.parse(raw), lastActivity: Date.now() }))
      } catch {}
    }
    events.forEach(e => window.addEventListener(e, touch, { passive: true }))
    const timer = setInterval(() => {
      const raw = localStorage.getItem(SESSION_KEY)
      if (!raw) { setUser(null); return }
      try {
        const { lastActivity } = JSON.parse(raw)
        if (Date.now() - lastActivity > INACTIVITY_LIMIT) {
          localStorage.removeItem(SESSION_KEY)
          setUser(null)
        }
      } catch { localStorage.removeItem(SESSION_KEY); setUser(null) }
    }, 60 * 1000)
    return () => {
      events.forEach(e => window.removeEventListener(e, touch))
      clearInterval(timer)
    }
  }, [user])

  // ── Auth ───────────────────────────────────────────────────
  async function login(username, password) {
    try {
      const { user: u } = await api.post('/auth/login', { username, password })
      setUser(u)
      localStorage.setItem(SESSION_KEY, JSON.stringify({ user: u, lastActivity: Date.now() }))
      return true
    } catch {
      return false
    }
  }
  function logout() {
    setUser(null)
    localStorage.removeItem(SESSION_KEY)
  }

  // ── Staff accounts ─────────────────────────────────────────
  async function addUser(u) {
    const tempId = Date.now()
    const temp = { ...u, id: tempId }
    setUsers(prev => [...prev, temp])
    try {
      const saved = await api.post('/users', u)
      setUsers(prev => prev.map(x => x.id === tempId ? saved : x))
    } catch (err) {
      setUsers(prev => prev.filter(x => x.id !== tempId))
      console.error('addUser failed:', err.message)
    }
  }
  async function updateUser(id, data) {
    const prev = users
    setUsers(u => u.map(x => x.id === id ? { ...x, ...data } : x))
    if (user?.id === id) setUser(u => ({ ...u, ...data }))
    try {
      const saved = await api.put(`/users/${id}`, data)
      setUsers(u => u.map(x => x.id === id ? saved : x))
    } catch (err) {
      setUsers(prev)
      console.error('updateUser failed:', err.message)
    }
  }
  async function deleteUser(id) {
    setUsers(prev => prev.filter(u => u.id !== id))
    if (user?.id === id) setUser(null)
    try { await api.del(`/users/${id}`) }
    catch (err) { console.error('deleteUser failed:', err.message) }
  }

  // ── Appointments ───────────────────────────────────────────
  async function addAppointment(apt) {
    const tempId = Date.now()
    const temp = { ...apt, id: tempId }
    setApts(prev => [...prev, temp])
    try {
      const saved = await api.post('/appointments', apt)
      setApts(prev => prev.map(a => a.id === tempId ? saved : a))
    } catch (err) {
      setApts(prev => prev.filter(a => a.id !== tempId))
      console.error('addAppointment failed:', err.message)
    }
  }
  async function updateAppointment(id, updates) {
    setApts(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a))
    try {
      const current = appointments.find(a => a.id === id) || {}
      const saved = await api.put(`/appointments/${id}`, { ...current, ...updates })
      setApts(prev => prev.map(a => a.id === id ? saved : a))
    } catch (err) { console.error('updateAppointment failed:', err.message) }
  }
  async function deleteAppointment(id) {
    setApts(prev => prev.filter(a => a.id !== id))
    try { await api.del(`/appointments/${id}`) }
    catch (err) { console.error('deleteAppointment failed:', err.message) }
  }

  // ── Technicians ────────────────────────────────────────────
  async function addTechnician(t) {
    const tempId = Date.now()
    const temp = { ...t, id: tempId }
    setTechs(prev => [...prev, temp])
    try {
      const saved = await api.post('/technicians', t)
      setTechs(prev => prev.map(x => x.id === tempId ? saved : x))
    } catch (err) {
      setTechs(prev => prev.filter(x => x.id !== tempId))
      console.error('addTechnician failed:', err.message)
    }
  }
  async function updateTechnician(id, upd) {
    setTechs(prev => prev.map(t => t.id === id ? { ...t, ...upd } : t))
    try {
      const saved = await api.put(`/technicians/${id}`, upd)
      setTechs(prev => prev.map(t => t.id === id ? saved : t))
    } catch (err) { console.error('updateTechnician failed:', err.message) }
  }
  async function deleteTechnician(id) {
    setTechs(prev => prev.filter(t => t.id !== id))
    try { await api.del(`/technicians/${id}`) }
    catch (err) { console.error('deleteTechnician failed:', err.message) }
  }

  // ── Clients ────────────────────────────────────────────────
  async function addClient(c) {
    const tempId = Date.now()
    const temp = { ...c, id: tempId, serviceHistory: [], totalVisits: 0, lastVisit: '—' }
    setClients(prev => [...prev, temp])
    try {
      const saved = await api.post('/clients', c)
      setClients(prev => prev.map(x => x.id === tempId ? saved : x))
    } catch (err) {
      setClients(prev => prev.filter(x => x.id !== tempId))
      console.error('addClient failed:', err.message)
    }
  }
  async function updateClient(id, upd) {
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...upd } : c))
    try {
      const saved = await api.put(`/clients/${id}`, upd)
      setClients(prev => prev.map(c => c.id === id ? saved : c))
    } catch (err) { console.error('updateClient failed:', err.message) }
  }
  async function deleteClient(id) {
    setClients(prev => prev.filter(c => c.id !== id))
    try { await api.del(`/clients/${id}`) }
    catch (err) { console.error('deleteClient failed:', err.message) }
  }
  async function addServiceEntry(clientId, entry) {
    // Optimistic update
    const tempId = Date.now()
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c
      const history = [...(c.serviceHistory || []), { ...entry, id: tempId }]
      return { ...c, serviceHistory: history, totalVisits: history.length, lastVisit: entry.date }
    }))
    try {
      const saved = await api.post(`/clients/${clientId}/history`, entry)
      setClients(prev => prev.map(c => c.id === clientId ? saved : c))
    } catch (err) { console.error('addServiceEntry failed:', err.message) }
  }
  async function deleteServiceEntry(clientId, entryId) {
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c
      const history = (c.serviceHistory || []).filter(h => h.id !== entryId)
      return { ...c, serviceHistory: history, totalVisits: history.length }
    }))
    try {
      const saved = await api.del(`/clients/${clientId}/history/${entryId}`)
      setClients(prev => prev.map(c => c.id === clientId ? saved : c))
    } catch (err) { console.error('deleteServiceEntry failed:', err.message) }
  }

  // ── Gift cards ─────────────────────────────────────────────
  async function addGiftCard(gc) {
    const tempId = Date.now()
    const temp = { ...gc, id: tempId }
    setGiftCards(prev => [...prev, temp])
    try {
      const saved = await api.post('/giftcards', gc)
      setGiftCards(prev => prev.map(g => g.id === tempId ? saved : g))
    } catch (err) {
      setGiftCards(prev => prev.filter(g => g.id !== tempId))
      console.error('addGiftCard failed:', err.message)
    }
  }
  async function updateGiftCard(id, upd) {
    setGiftCards(prev => prev.map(g => g.id === id ? { ...g, ...upd } : g))
  }
  async function deleteGiftCard(id) {
    setGiftCards(prev => prev.filter(g => g.id !== id))
    try { await api.del(`/giftcards/${id}`) }
    catch (err) { console.error('deleteGiftCard failed:', err.message) }
  }
  async function redeemGiftCard(id, amount) {
    setGiftCards(prev => prev.map(g => {
      if (g.id !== id) return g
      return { ...g, balance: Math.max(0, g.balance - amount) }
    }))
    try {
      const saved = await api.put(`/giftcards/${id}/redeem`, { amount })
      setGiftCards(prev => prev.map(g => g.id === id ? saved : g))
    } catch (err) { console.error('redeemGiftCard failed:', err.message) }
  }

  // ── Timeclock ─────────────────────────────────────────────
  const [clockStatus, setClockStatus] = useState([])
  
  async function fetchClockStatus() {
    try {
      const data = await api.get('/timeclock/status')
      setClockStatus(data)
    } catch (err) { console.error('fetchClockStatus failed:', err.message) }
  }

  useEffect(() => {
    if (user) fetchClockStatus()
  }, [user])

  async function clockIn(techId) {
    try {
      await api.post(`/timeclock/clockin/${techId}`)
      await fetchClockStatus()
      return true
    } catch (err) { console.error('clockIn failed:', err.message); return false }
  }

  async function clockOut(techId) {
    try {
      const res = await api.post(`/timeclock/clockout/${techId}`)
      await fetchClockStatus()
      return res
    } catch (err) { console.error('clockOut failed:', err.message); return false }
  }

  return (
    <AppContext.Provider value={{
      loading, apiError,
      companyInfo, updateCompanyInfo,
      user, users, login, logout, addUser, updateUser, deleteUser,
      technicians, addTechnician, updateTechnician, deleteTechnician,
      appointments, addAppointment, updateAppointment, deleteAppointment,
      clients, addClient, updateClient, deleteClient, addServiceEntry, deleteServiceEntry,
      giftCards, addGiftCard, updateGiftCard, deleteGiftCard, redeemGiftCard,
      clockStatus, clockIn, clockOut, refreshClock: fetchClockStatus,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() { return useContext(AppContext) }
