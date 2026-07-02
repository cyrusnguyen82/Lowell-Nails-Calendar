import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2 } from 'lucide-react';
import * as api from '../api';

const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const STEPS = ['Select Period', 'Review', 'Confirm'];

export default function PayrollRunPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedRunId, setSavedRunId] = useState(null);

  useEffect(() => {
    api.getDefaultPeriod().then((d) => { setPeriodStart(d.period_start); setPeriodEnd(d.period_end); });
  }, []);

  const runPreview = async () => {
    setError(''); setLoading(true);
    try {
      const data = await api.previewPayroll(periodStart, periodEnd);
      if (!data.entries.length) throw new Error('No active employees found with earnings for this period.');
      setPreview(data);
      setStep(2);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const confirmSave = async () => {
    setSaving(true); setError('');
    try {
      const res = await api.savePayroll(periodStart, periodEnd, preview.entries);
      if (!res.success) throw new Error(res.error);
      setSavedRunId(res.run_id);
      setStep(4);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="page-title">Run Payroll</p>
          <p className="page-subtitle">Weekly payroll runs Monday – Sunday</p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', maxWidth: 640 }}>
        {STEPS.map((label, i) => {
          const n = i + 1;
          const state = n < step ? 'done' : n === step ? 'active' : 'pending';
          return (
            <React.Fragment key={label}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.8rem', fontWeight: 700,
                  background: state === 'pending' ? 'var(--bg-card)' : state === 'done' ? 'var(--accent-green)' : 'var(--accent-blue)',
                  color: state === 'pending' ? 'var(--text-muted)' : '#fff',
                  border: state === 'pending' ? '2px solid var(--border)' : 'none',
                }}>{state === 'done' ? <CheckCircle2 size={16} /> : n}</div>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: state === 'pending' ? 'var(--text-muted)' : 'var(--text-main)' }}>{label}</span>
              </div>
              {i < STEPS.length - 1 && <div style={{ flex: 1, height: 2, background: 'var(--border)' }} />}
            </React.Fragment>
          );
        })}
      </div>

      {error && <div className="login-error" style={{ maxWidth: 640 }}>{error}</div>}

      {step === 1 && (
        <div className="panel" style={{ maxWidth: 640 }}>
          <div className="panel-body">
            <div className="form-grid">
              <label>Period Start (Monday)
                <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
              </label>
              <label>Period End (Sunday)
                <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
              </label>
            </div>
            <div style={{ marginTop: '1rem' }}>
              <button className="btn-primary" onClick={runPreview} disabled={loading || !periodStart || !periodEnd}>
                {loading ? <Loader2 size={16} className="spin" /> : null}
                {loading ? 'Computing payroll…' : 'Preview Payroll'}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 2 && preview && (
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Review Payroll</span>
            <span className="text-muted" style={{ fontSize: '0.8rem' }}>{fmtDate(preview.period_start)} – {fmtDate(preview.period_end)}</span>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr><th>Employee</th><th>Type</th><th className="num">Hours</th><th className="num">Gross</th><th className="num">Taxes</th><th className="num">Er. Taxes</th><th className="num">Net Pay</th></tr>
              </thead>
              <tbody>
                {preview.entries.map((e) => (
                  <tr key={e.tech_id}>
                    <td>{e.name}<div className="text-muted" style={{ fontSize: '0.72rem', textTransform: 'capitalize' }}>{e.basis}{e.hours > 0 ? ` · ${e.hours.toFixed(1)} hrs` : ''}</div></td>
                    <td><span className={`badge ${e.type === 'w2' ? 'badge-blue' : 'badge-orange'}`}>{e.type === 'w2' ? 'W-2' : '1099'}</span></td>
                    <td className="num">{e.hours > 0 ? e.hours.toFixed(1) : '—'}</td>
                    <td className="num">{fmt(e.gross)}</td>
                    <td className="num accent-red">{e.type === 'w2' ? `-${fmt(e.taxes.total_ded)}` : '—'}</td>
                    <td className="num">{e.type === 'w2' ? fmt(e.taxes.total_er) : '—'}</td>
                    <td className="num accent-green" style={{ fontWeight: 700 }}>{fmt(e.net)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--bg-dark)', fontWeight: 700 }}>
                  <td>TOTAL</td><td></td><td></td>
                  <td className="num">{fmt(preview.total_gross)}</td><td></td>
                  <td className="num">{fmt(preview.total_er_tax)}</td>
                  <td className="num accent-green">{fmt(preview.total_net)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="modal-footer">
            <button className="btn-secondary" onClick={() => setStep(1)}>← Back</button>
            <button className="btn-primary" onClick={() => setStep(3)}>Looks Good — Confirm →</button>
          </div>
        </div>
      )}

      {step === 3 && preview && (
        <div className="panel" style={{ maxWidth: 560 }}>
          <div className="panel-body">
            <p style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Ready to save this payroll run?</p>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
              This will create a <strong>draft</strong> payroll run. You'll need to issue payments and mark it as paid.
            </p>
            <div className="panel" style={{ background: 'var(--bg-dark)', border: 'none', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="text-muted">Pay period</span><span>{periodStart} to {periodEnd}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="text-muted">Employees</span><span>{preview.entries.length}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="text-muted">Total gross</span><span style={{ fontWeight: 700 }}>{fmt(preview.total_gross)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="text-muted">Total net pay</span><span className="accent-green" style={{ fontWeight: 700 }}>{fmt(preview.total_net)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="text-muted">Total employer taxes</span><span style={{ fontWeight: 700 }}>{fmt(preview.total_er_tax)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '0.4rem' }}><span className="text-muted">Total liability</span><span style={{ fontWeight: 700 }}>{fmt(preview.total_gross + preview.total_er_tax)}</span></div>
            </div>
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
              <button className="btn-primary" onClick={confirmSave} disabled={saving}>{saving ? 'Saving…' : 'Save Payroll Run'}</button>
              <button className="btn-secondary" onClick={() => setStep(2)}>← Back to Review</button>
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="panel" style={{ maxWidth: 480, textAlign: 'center' }}>
          <div className="panel-body">
            <CheckCircle2 size={48} className="accent-green" style={{ margin: '0 auto 1rem' }} />
            <p style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.4rem' }}>Payroll Run Saved!</p>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>Issue payments to each employee, then mark the run as paid.</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
              <button className="btn-primary" onClick={() => navigate(`/payroll/run/${savedRunId}/stubs`)}>View Pay Stubs</button>
              <button className="btn-secondary" onClick={() => navigate('/payroll')}>← Back to Payroll</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
