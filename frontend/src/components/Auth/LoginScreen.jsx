import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import './Auth.css'

function CompanyLogo({ logoUrl, name, size = 90 }) {
  const [imgErr, setImgErr] = useState(false)
  if (!imgErr && logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name}
        style={{ height: size, maxWidth: '100%', objectFit: 'contain', marginBottom: 10 }}
        onError={() => setImgErr(true)}
      />
    )
  }
  /* Fallback: initials circle */
  const initials = name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #0f172a, #4f46e5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.3, fontWeight: 800, color: '#fff', marginBottom: 10,
    }}>
      {initials}
    </div>
  )
}

export default function LoginScreen() {
  const { login, companyInfo } = useApp()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    const ok = await login(username, password)
    if (!ok) setError('Invalid username or password.')
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 8 }}>
          <CompanyLogo logoUrl={companyInfo.logoUrl} name={companyInfo.name} size={90} />
          <div className="login-company-name">{companyInfo.name}</div>
          {companyInfo.address && (
            <div className="login-company-address">
              {companyInfo.address}{companyInfo.city ? `, ${companyInfo.city}` : ''}<br />
              {companyInfo.phone}
            </div>
          )}
        </div>

        <p className="login-subtitle">Sign in to continue</p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); setError('') }}
              placeholder="Enter username"
              autoFocus
            />
          </div>
          <div className="login-field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              placeholder="Enter password"
            />
          </div>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="login-btn">Sign In</button>
        </form>

        <div className="login-hint">
          <p>Accounts:</p>
          <code>admin / admin123</code>
          <code>jane / staff123</code>
          <code>tina / tech123</code>
        </div>
      </div>
    </div>
  )
}
