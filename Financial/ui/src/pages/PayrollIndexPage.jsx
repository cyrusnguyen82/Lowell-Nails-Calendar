import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PlayCircle } from 'lucide-react';
import * as api from '../api';

const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export default function PayrollIndexPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getPayrollIndex().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="page-container"><div className="page-error">{error}</div></div>;
  if (!data) return <div className="page-container"><div className="page-loading">Loading…</div></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="page-title">Payroll</p>
          <p className="page-subtitle">Weekly runs, employees, and tax reports</p>
        </div>
        <Link to="/payroll/run" className="btn-primary"><PlayCircle size={16} /> Run Payroll</Link>
      </div>

      <div className="stat-grid">
        <div className="stat-card"><span className="stat-label">Active Employees</span><span className="stat-value">{data.emp_count}</span></div>
        <div className="stat-card"><span className="stat-label">W-2</span><span className="stat-value">{data.w2_count}</span></div>
        <div className="stat-card"><span className="stat-label">1099 Contractors</span><span className="stat-value">{data.cont_count}</span></div>
        <div className="stat-card">
          <span className="stat-label">Next Period</span>
          <span className="stat-value" style={{ fontSize: '1.1rem' }}>{fmtDate(data.next_period_start)} – {fmtDate(data.next_period_end)}</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header"><span className="panel-title">Recent Runs</span></div>
        {data.runs.length === 0 ? (
          <div className="page-empty">No payroll runs yet. <Link className="link-btn" to="/payroll/run">Run your first payroll →</Link></div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr><th>Period</th><th>Pay Date</th><th>Status</th><th className="num">Gross</th><th className="num">Net</th><th className="num">Er. Tax</th><th></th></tr>
              </thead>
              <tbody>
                {data.runs.map((r) => (
                  <tr key={r.id}>
                    <td>{fmtDate(r.pay_period_start)} – {fmtDate(r.pay_period_end)}</td>
                    <td>{fmtDate(r.pay_date)}</td>
                    <td><span className={`badge ${r.status === 'paid' ? 'badge-green' : r.status === 'void' ? 'badge-gray' : 'badge-orange'}`}>{r.status}</span></td>
                    <td className="num">{fmt(r.total_gross)}</td>
                    <td className="num">{fmt(r.total_net)}</td>
                    <td className="num">{fmt(r.total_employer_tax)}</td>
                    <td><Link className="link-btn" to={`/payroll/run/${r.id}/stubs`}>Stubs</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
