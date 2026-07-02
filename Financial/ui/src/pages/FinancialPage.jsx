import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, Trash2 } from 'lucide-react';
import * as api from '../api';

const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const pctChange = (curr, prev) => (prev ? ((curr - prev) / prev) * 100 : 0);

function ExpenseModal({ categories, onClose, onSaved }) {
  const [form, setForm] = useState({
    amount: '', category: 'supplies', note: '',
    expense_date: new Date().toISOString().slice(0, 10),
    recurring: false, personal: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.addExpense({ ...form, amount: parseFloat(form.amount) });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Log Expense</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="login-error">{error}</div>}
            <div className="form-grid">
              <label>Amount ($)
                <input type="number" step="0.01" min="0" required value={form.amount}
                  onChange={(e) => set('amount', e.target.value)} placeholder="0.00" autoFocus />
              </label>
              <label>Date
                <input type="date" value={form.expense_date} onChange={(e) => set('expense_date', e.target.value)} />
              </label>
              <label className="span-2">Category
                <select value={form.category} onChange={(e) => set('category', e.target.value)}>
                  {categories.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                </select>
              </label>
              <label className="span-2">Vendor / Note
                <input value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="e.g. Amazon - supplies" />
              </label>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <label className="checkbox-row">
                <input type="checkbox" checked={form.recurring} onChange={(e) => set('recurring', e.target.checked)} />
                Recurring monthly
              </label>
              <label className="checkbox-row">
                <input type="checkbox" checked={form.personal} onChange={(e) => set('personal', e.target.checked)} />
                Personal (exclude from reports)
              </label>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save Expense'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function FinancialPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(() => {
    api.getFinancial().then(setData).catch((e) => setError(e.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    await api.deleteExpense(id);
    load();
  };

  if (error) return <div className="page-container"><div className="page-error">{error}</div></div>;
  if (!data) return <div className="page-container"><div className="page-loading">Loading…</div></div>;

  const changeWeek = pctChange(data.rev_week, data.rev_last_week);
  const changeMonth = pctChange(data.rev_month, data.rev_last_month);
  const maxRev = Math.max(...data.trend.map((t) => t.revenue), 1);
  const maxExp = Math.max(...data.exp_by_cat.map((c) => c.total), 1);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="page-title">Financial Dashboard</p>
          <p className="page-subtitle">Revenue, expenses, and estimated profit</p>
        </div>
        <button className="btn-primary" onClick={() => setModalOpen(true)}><Plus size={16} /> Log Expense</button>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-label">Revenue This Week</span>
          <span className="stat-value">{fmt(data.rev_week)}</span>
          <span className={`stat-change ${changeWeek >= 0 ? 'up' : 'down'}`}>{changeWeek >= 0 ? '▲' : '▼'} {Math.abs(changeWeek).toFixed(1)}% vs last week</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Revenue This Month</span>
          <span className="stat-value">{fmt(data.rev_month)}</span>
          <span className={`stat-change ${changeMonth >= 0 ? 'up' : 'down'}`}>{changeMonth >= 0 ? '▲' : '▼'} {Math.abs(changeMonth).toFixed(1)}% vs last month</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Expenses This Month</span>
          <span className="stat-value">{fmt(data.exp_month)}</span>
          <span className="stat-sub">business only</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Est. Profit (Month)</span>
          <span className="stat-value" style={{ color: data.profit_month >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>{fmt(data.profit_month)}</span>
          <span className="stat-sub">rev – exp – payroll</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Revenue — Last 6 Months</span></div>
          <div className="panel-body">
            {data.trend.every((t) => t.revenue === 0) ? (
              <div className="page-empty">No revenue data yet.</div>
            ) : (
              <div className="bar-chart">
                {data.trend.map((m) => (
                  <div className="bar-col" key={m.month}>
                    <span className="bar-value">{fmt(m.revenue)}</span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ height: `${Math.max((m.revenue / maxRev) * 100, 2)}%` }} />
                    </div>
                    <span className="bar-label">{m.month}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header"><span className="panel-title">Expenses by Category</span></div>
          <div className="panel-body">
            {data.exp_by_cat.length === 0 ? (
              <div className="page-empty">No expenses this month.</div>
            ) : (
              data.exp_by_cat.map((c) => (
                <div className="hbar-row" key={c.category}>
                  <span className="hbar-label">{c.category.replace(/_/g, ' ')}</span>
                  <div className="hbar-track"><div className="hbar-fill" style={{ width: `${(c.total / maxExp) * 100}%` }} /></div>
                  <span className="hbar-value">{fmt(c.total)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card"><span className="stat-label">YTD Revenue</span><span className="stat-value">{fmt(data.rev_year)}</span></div>
        <div className="stat-card"><span className="stat-label">YTD Expenses</span><span className="stat-value">{fmt(data.exp_year)}</span></div>
        <div className="stat-card"><span className="stat-label">Payroll This Month</span><span className="stat-value">{fmt(data.payroll_month)}</span></div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Recent Expenses</span>
          <span className="text-muted" style={{ fontSize: '0.75rem' }}>Last 10 entries</span>
        </div>
        {data.recent_exp.length === 0 ? (
          <div className="page-empty">
            No expenses logged yet.
            <button className="link-btn" onClick={() => setModalOpen(true)}>Log first expense →</button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr><th>Date</th><th>Category</th><th>Note</th><th>Recurring</th><th className="num">Amount</th><th></th></tr>
              </thead>
              <tbody>
                {data.recent_exp.map((e) => (
                  <tr key={e.id}>
                    <td>{fmtDate(e.expense_date)}</td>
                    <td><span className="badge badge-gray">{e.category.replace(/_/g, ' ')}</span></td>
                    <td>{e.note || '—'}</td>
                    <td>{e.recurring ? <span className="badge badge-blue">Monthly</span> : '—'}</td>
                    <td className="num">{fmt(e.amount)}</td>
                    <td><button className="icon-btn danger" onClick={() => handleDelete(e.id)}><Trash2 size={15} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <ExpenseModal
          categories={data.categories}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); load(); }}
        />
      )}
    </div>
  );
}
