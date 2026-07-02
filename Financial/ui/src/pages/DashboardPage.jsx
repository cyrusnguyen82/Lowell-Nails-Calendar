import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import * as api from '../api';

const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getDashboard().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="page-container"><div className="page-error">{error}</div></div>;
  if (!data) return <div className="page-container"><div className="page-loading">Loading…</div></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="page-title">Dashboard</p>
          <p className="page-subtitle">Revenue, payroll, and upcoming tax deadlines</p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-label">Revenue This Week</span>
          <span className="stat-value">{fmt(data.rev_week)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Revenue This Month</span>
          <span className="stat-value">{fmt(data.rev_month)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Payroll Gross This Week</span>
          <span className="stat-value">{fmt(data.payroll_week_gross)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Hours Worked This Week</span>
          <span className="stat-value">{Number(data.hours_week).toFixed(1)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Active Employees</span>
          <span className="stat-value">{data.emp_count}</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header"><span className="panel-title">Recent Payroll Runs</span>
          <Link to="/payroll" className="link-btn">View all →</Link>
        </div>
        {data.recent_runs.length === 0 ? (
          <div className="page-empty">No payroll runs yet.</div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Period</th><th>Status</th><th className="num">Gross</th><th className="num">Net</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_runs.map((r) => (
                  <tr key={r.id}>
                    <td>{fmtDate(r.pay_period_start)} – {fmtDate(r.pay_period_end)}</td>
                    <td><span className={`badge ${r.status === 'paid' ? 'badge-green' : r.status === 'void' ? 'badge-gray' : 'badge-orange'}`}>{r.status}</span></td>
                    <td className="num">{fmt(r.total_gross)}</td>
                    <td className="num">{fmt(r.total_net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data.upcoming_deadlines.length > 0 && (
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Upcoming Tax Deadlines</span></div>
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {data.upcoming_deadlines.map((d) => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <AlertCircle size={16} className={d.days_away <= 14 ? 'accent-red' : 'text-muted'} />
                <span style={{ flex: 1 }}>{d.name}</span>
                <span className="text-muted">{d.days_away} days away</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
