import React, { useState, useEffect } from 'react';
import { AlertCircle, FileText } from 'lucide-react';
import * as api from '../api';

const fmtDate = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

const FORM_CARDS = [
  { form: '941', title: 'Form 941', cadence: 'Quarterly', desc: "Reports withheld federal income tax, Social Security, and Medicare. Filed quarterly with the IRS.", color: 'var(--accent-blue)' },
  { form: '940', title: 'Form 940', cadence: 'Annual', desc: 'Reports FUTA tax paid on first $7,000 of each W-2 employee\'s wages. Due January 31.', color: '#c2410c' },
  { form: 'w2', title: 'W-2 Prep', cadence: 'Annual', desc: 'Wage and Tax Statement data for all W-2 employees.', color: 'var(--accent-green)' },
  { form: '1099', title: '1099-NEC Prep', cadence: 'Annual', desc: 'Nonemployee compensation data for contractors paid $600+.', color: 'var(--accent-gold)' },
];

export default function PayrollReportsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getPayrollReports().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="page-container"><div className="page-error">{error}</div></div>;
  if (!data) return <div className="page-container"><div className="page-loading">Loading…</div></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="page-title">Tax Reports</p>
          <p className="page-subtitle">EIN: {data.employer_ein}</p>
        </div>
      </div>

      {data.deadlines.length > 0 && (
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Upcoming Deadlines</span></div>
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {data.deadlines.map((d) => {
              const days = Math.round((new Date(d.due) - new Date()) / 86400000);
              return (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <AlertCircle size={16} className={days <= 14 ? 'accent-red' : 'text-muted'} />
                  <span style={{ flex: 1 }}>{d.name}</span>
                  <span className="text-muted" style={{ fontSize: '0.8rem' }}>Due {fmtDate(d.due)}</span>
                  <span className="badge badge-gray">{d.form.toUpperCase()}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
        {FORM_CARDS.map((c) => (
          <div className="panel" key={c.form}>
            <div className="panel-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div>
                  <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: c.color }}>{c.cadence}</p>
                  <p style={{ fontWeight: 700 }}>{c.title}</p>
                </div>
                <FileText size={22} color={c.color} />
              </div>
              <p className="text-muted" style={{ fontSize: '0.78rem' }}>{c.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
