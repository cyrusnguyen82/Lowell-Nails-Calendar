import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import './Auth.css'

function CompanyLogo({ logoUrl, name, size = 80 }) {
  const [imgErr, setImgErr] = useState(false)
  if (!imgErr && logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name}
        style={{ height: size, maxWidth: 180, objectFit: 'contain' }}
        onError={() => setImgErr(true)}
      />
    )
  }
  const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: 18,
      background: 'linear-gradient(135deg, var(--accent) 0%, var(--brand) 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.32, fontWeight: 800, color: '#fff',
      boxShadow: '0 8px 24px rgba(99,102,241,0.3)',
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
        {/* Brand */}
        <div className="login-logo-wrap">
          <CompanyLogo logoUrl={companyInfo.logoUrl} name={companyInfo.name || 'Lowell Nails & Spa'} size={80} />
          <div>
            <div className="login-company-name">{companyInfo.name || 'Lowell Nails & Spa'}</div>
            {companyInfo.address && (
              <div className="login-company-address">
                {companyInfo.address}{companyInfo.city ? `, ${companyInfo.city}` : ''}
                {companyInfo.phone && <><br />{companyInfo.phone}</>}
              </div>
            )}
          </div>
        </div>

        <div className="login-divider" />

        <p className="login-subtitle">Sign in to your account</p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label htmlFor="ln-user">Username</label>
            <input
              id="ln-user"
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); setError('') }}
              placeholder="Enter your username"
              autoFocus
              autoComplete="username"
            />
          </div>
          <div className="login-field">
            <label htmlFor="ln-pass">Password</label>
            <input
              id="ln-pass"
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </div>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="login-btn">Sign In</button>
        </form>
      </div>
    </div>
  )
}
