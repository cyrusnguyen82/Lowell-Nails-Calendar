import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Printer } from 'lucide-react';
import * as api from '../api';

const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function Stub({ e, run }) {
  const w2 = e.employee_type === 'w2';
  return (
    <div className="panel stub-card" style={{ marginBottom: '1.25rem' }}>
      <div style={{ background: '#1e293b', color: '#fff', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: '1.1rem' }}>{e.name}</p>
          <p style={{ fontSize: '0.75rem', opacity: 0.7 }}>
            {w2 ? 'W-2 Employee' : '1099 Contractor'} · {e.emp?.pay_basis || ''}{e.emp?.state_code ? ` · ${e.emp.state_code}` : ''}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '0.7rem', opacity: 0.6, textTransform: 'uppercase' }}>Pay Statement</p>
          <p style={{ fontSize: '0.85rem' }}>{fmtDate(run.pay_period_start)} – {fmtDate(run.pay_period_end)}</p>
          <p style={{ fontSize: '0.7rem', opacity: 0.6 }}>Pay Date: {fmtDate(run.pay_date)}</p>
        </div>
      </div>

      <div className="panel-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div>
          <p className="text-muted" style={{ fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Earnings</p>
          <table style={{ width: '100%', fontSize: '0.85rem' }}>
            <tbody>
              {e.regular_pay > 0 && <tr><td>Regular Pay {e.hours_worked ? <span className="text-muted">({Number(e.hours_worked).toFixed(2)}h @ {fmt(e.hourly_rate)})</span> : null}</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(e.regular_pay)}</td></tr>}
              {e.overtime_pay > 0 && <tr><td>Overtime Pay <span className="text-muted">(1.5x)</span></td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(e.overtime_pay)}</td></tr>}
              {e.commission_pay > 0 && <tr><td>Commission</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(e.commission_pay)}</td></tr>}
              <tr style={{ borderTop: '1px solid var(--border)' }}><td style={{ fontWeight: 700, paddingTop: '0.4rem' }}>Gross Pay</td><td style={{ textAlign: 'right', fontWeight: 700, paddingTop: '0.4rem' }}>{fmt(e.gross_pay)}</td></tr>
            </tbody>
          </table>
        </div>

        <div>
          {w2 ? (
            <>
              <p className="text-muted" style={{ fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Deductions</p>
              <table style={{ width: '100%', fontSize: '0.85rem' }}>
                <tbody>
                  {e.federal_income_tax > 0 && <tr><td>Federal Income Tax</td><td style={{ textAlign: 'right' }}>{fmt(e.federal_income_tax)}</td></tr>}
                  {e.social_security_tax > 0 && <tr><td>Social Security (6.2%)</td><td style={{ textAlign: 'right' }}>{fmt(e.social_security_tax)}</td></tr>}
                  {e.medicare_tax > 0 && <tr><td>Medicare (1.45%)</td><td style={{ textAlign: 'right' }}>{fmt(e.medicare_tax)}</td></tr>}
                  {e.additional_medicare > 0 && <tr><td>Additional Medicare (0.9%)</td><td style={{ textAlign: 'right' }}>{fmt(e.additional_medicare)}</td></tr>}
                  {e.state_income_tax > 0 && <tr><td>State Income Tax {e.emp?.state_code ? `(${e.emp.state_code})` : ''}</td><td style={{ textAlign: 'right' }}>{fmt(e.state_income_tax)}</td></tr>}
                  {e.state_sdi > 0 && <tr><td>State SDI</td><td style={{ textAlign: 'right' }}>{fmt(e.state_sdi)}</td></tr>}
                  {e.city_income_tax > 0 && <tr><td>City Income Tax</td><td style={{ textAlign: 'right' }}>{fmt(e.city_income_tax)}</td></tr>}
                  <tr style={{ borderTop: '1px solid var(--border)' }}><td style={{ fontWeight: 700, paddingTop: '0.4rem' }}>Total Deductions</td><td className="accent-red" style={{ textAlign: 'right', fontWeight: 700, paddingTop: '0.4rem' }}>{fmt(e.total_deductions)}</td></tr>
                </tbody>
              </table>
            </>
          ) : (
            <>
              <p className="text-muted" style={{ fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Notes</p>
              <p className="text-muted" style={{ fontSize: '0.78rem' }}>No employer tax withholding for 1099 contractors.</p>
              <p className="text-muted" style={{ fontSize: '0.78rem' }}>Contractor is responsible for self-employment tax (SE tax ≈ 15.3%).</p>
              {e.gross_pay >= 600 && <p style={{ fontSize: '0.78rem', color: '#c2410c', marginTop: '0.5rem' }}>IRS threshold met — will appear on 1099-NEC.</p>}
            </>
          )}
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', padding: '0.9rem 1.5rem', background: 'var(--bg-dark)', display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '2rem' }}>
          <div><p className="text-muted" style={{ fontSize: '0.68rem', textTransform: 'uppercase' }}>YTD Gross</p><p style={{ fontWeight: 700 }}>{fmt(e.ytd_gross)}</p></div>
          {w2 && <div><p className="text-muted" style={{ fontSize: '0.68rem', textTransform: 'uppercase' }}>YTD Federal Tax</p><p style={{ fontWeight: 700 }}>{fmt(e.ytd_federal_tax)}</p></div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <p className="text-muted" style={{ fontSize: '0.68rem', textTransform: 'uppercase' }}>Net Pay</p>
          <p className="accent-green" style={{ fontSize: '1.4rem', fontWeight: 800 }}>{fmt(e.net_pay)}</p>
        </div>
      </div>

      {w2 && (
        <div className="no-print" style={{ borderTop: '1px dashed var(--border)', padding: '0.6rem 1.5rem', background: '#fffbeb', fontSize: '0.72rem', color: '#92400e' }}>
          Employer Taxes (not deducted): SS {fmt(e.employer_ss)} · Medicare {fmt(e.employer_medicare)} · FUTA {fmt(e.employer_futa)} · SUTA {fmt(e.employer_suta)} · Total {fmt(e.total_employer_tax)}
        </div>
      )}
    </div>
  );
}

export default function PayrollStubsPage() {
  const { runId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getStubs(runId).then(setData).catch((e) => setError(e.message));
  }, [runId]);

  if (error) return <div className="page-container"><div className="page-error">{error}</div></div>;
  if (!data) return <div className="page-container"><div className="page-loading">Loading…</div></div>;

  return (
    <div className="page-container">
      <div className="page-header no-print">
        <div>
          <p className="page-title">Pay Stubs</p>
          <p className="page-subtitle">{fmtDate(data.run.pay_period_start)} – {fmtDate(data.run.pay_period_end)} · {data.entries.length} employees · {data.run.status}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-secondary" onClick={() => window.print()}><Printer size={16} /> Print All</button>
          <Link to="/payroll" className="btn-secondary">← Back to Payroll</Link>
        </div>
      </div>

      {data.entries.length === 0 ? (
        <div className="page-empty">No entries found for this payroll run.</div>
      ) : (
        data.entries.map((e) => <Stub key={e.id} e={e} run={data.run} />)
      )}
    </div>
  );
}
