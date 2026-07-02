import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import * as api from '../api';
import logo from '../assets/logo_transparent.png';

export default function LoginPage({ onLoggedIn }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.login(username, password);
      onLoggedIn();
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          <img src={logo} alt="Logo" className="login-logo" />
          <div>
            <p className="login-company">Lowell Nails and Spa</p>
            <p className="login-tagline">Financial &amp; Payroll</p>
          </div>
        </div>
        <div className="login-divider" />
        <p className="login-subtitle">Sign in to your account</p>
        {error && <div className="login-error">{error}</div>}
        <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
          <label>
            Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required autoComplete="username" />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </label>
        </div>
        <button type="submit" className="btn-primary" disabled={busy} style={{ justifyContent: 'center' }}>
          {busy ? <Loader2 size={16} className="spin" /> : null}
          {busy ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
