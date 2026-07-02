import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import * as api from '../api';

const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const BLANK = {
  technician_id: '', employee_type: 'w2', filing_status: 'single',
  federal_allowances: 0, federal_extra_withholding: 0,
  state_code: 'MI', state_allowances: 0, state_extra_withholding: 0,
  city_code: '', city_resident: true,
  pay_basis: 'hourly', hourly_rate: 0, salary_annual: 0, commission_rate: 0.45,
  ssn_last4: '', email: '', notes: '',
};

function EmployeeModal({ employee, unlinked, onClose, onSaved }) {
  const [form, setForm] = useState(employee
    ? { ...BLANK, ...employee, technician_id: employee.technician_id }
    : { ...BLANK, technician_id: unlinked[0]?.id || '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.saveEmployee({
        ...form,
        technician_id: parseInt(form.technician_id, 10),
        federal_allowances: parseInt(form.federal_allowances, 10) || 0,
        federal_extra_withholding: parseFloat(form.federal_extra_withholding) || 0,
        state_allowances: parseInt(form.state_allowances, 10) || 0,
        state_extra_withholding: parseFloat(form.state_extra_withholding) || 0,
        hourly_rate: parseFloat(form.hourly_rate) || 0,
        salary_annual: parseFloat(form.salary_annual) || 0,
        commission_rate: parseFloat(form.commission_rate) || 0,
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ width: 640 }}>
        <div className="modal-header">
          <h3>{employee ? 'Edit Employee' : 'Add Employee'}</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="login-error">{error}</div>}
            <div className="form-grid">
              {!employee && (
                <label className="span-2">Technician
                  <select value={form.technician_id} onChange={(e) => set('technician_id', e.target.value)} required>
                    <option value="" disabled>Select a technician…</option>
                    {unlinked.map((t) => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
                  </select>
                </label>
              )}
              <label>Employee Type
                <select value={form.employee_type} onChange={(e) => set('employee_type', e.target.value)}>
                  <option value="w2">W-2 Employee</option>
                  <option value="contractor">1099 Contractor</option>
                </select>
              </label>
              <label>Pay Basis
                <select value={form.pay_basis} onChange={(e) => set('pay_basis', e.target.value)}>
                  <option value="hourly">Hourly</option>
                  <option value="salary">Salary</option>
                  <option value="commission">Commission</option>
                  <option value="hybrid">Hybrid (hourly + commission)</option>
                </select>
              </label>

              {(form.pay_basis === 'hourly' || form.pay_basis === 'hybrid') && (
                <label>Hourly Rate ($)
                  <input type="number" step="0.01" min="0" value={form.hourly_rate} onChange={(e) => set('hourly_rate', e.target.value)} />
                </label>
              )}
              {form.pay_basis === 'salary' && (
                <label>Annual Salary ($)
                  <input type="number" step="0.01" min="0" value={form.salary_annual} onChange={(e) => set('salary_annual', e.target.value)} />
                </label>
              )}
              {(form.pay_basis === 'commission' || form.pay_basis === 'hybrid') && (
                <label>Commission Rate (0–1)
                  <input type="number" step="0.01" min="0" max="1" value={form.commission_rate} onChange={(e) => set('commission_rate', e.target.value)} />
                </label>
              )}

              {form.employee_type === 'w2' && (
                <>
                  <label>Filing Status
                    <select value={form.filing_status} onChange={(e) => set('filing_status', e.target.value)}>
                      <option value="single">Single</option>
                      <option value="married">Married</option>
                      <option value="head_of_household">Head of Household</option>
                    </select>
                  </label>
                  <label>State
                    <input value={form.state_code} onChange={(e) => set('state_code', e.target.value.toUpperCase())} maxLength={2} placeholder="MI" />
                  </label>
                  <label>Federal Allowances
                    <input type="number" min="0" value={form.federal_allowances} onChange={(e) => set('federal_allowances', e.target.value)} />
                  </label>
                  <label>Federal Extra Withholding ($/period)
                    <input type="number" step="0.01" min="0" value={form.federal_extra_withholding} onChange={(e) => set('federal_extra_withholding', e.target.value)} />
                  </label>
                  <label>State Allowances / Exemptions
                    <input type="number" min="0" value={form.state_allowances} onChange={(e) => set('state_allowances', e.target.value)} />
                  </label>
                  <label>State Extra Withholding ($/period)
                    <input type="number" step="0.01" min="0" value={form.state_extra_withholding} onChange={(e) => set('state_extra_withholding', e.target.value)} />
                  </label>
                  <label>City Code (MI only)
                    <input value={form.city_code || ''} onChange={(e) => set('city_code', e.target.value)} placeholder="e.g. grand_rapids" />
                  </label>
                  <label className="checkbox-row" style={{ alignSelf: 'end', paddingBottom: '0.5rem' }}>
                    <input type="checkbox" checked={form.city_resident} onChange={(e) => set('city_resident', e.target.checked)} />
                    City resident (vs. non-resident rate)
                  </label>
                </>
              )}

              <label>Email
                <input type="email" value={form.email || ''} onChange={(e) => set('email', e.target.value)} />
              </label>
              <label>SSN Last 4
                <input value={form.ssn_last4 || ''} onChange={(e) => set('ssn_last4', e.target.value)} maxLength={4} />
              </label>
              <label className="span-2">Notes
                <textarea rows={2} value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} />
              </label>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save Employee'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PayrollEmployeesPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // null | { employee: null|obj }

  const load = useCallback(() => {
    api.getEmployees().then(setData).catch((e) => setError(e.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (error) return <div className="page-container"><div className="page-error">{error}</div></div>;
  if (!data) return <div className="page-container"><div className="page-loading">Loading…</div></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="page-title">Employees</p>
          <p className="page-subtitle">{data.employees.length} total · {data.employees.filter((e) => e.active).length} active</p>
        </div>
        {data.unlinked.length > 0 && (
          <button className="btn-primary" onClick={() => setModal({ employee: null })}><Plus size={16} /> Add Employee</button>
        )}
      </div>

      <div className="panel">
        {data.employees.length === 0 ? (
          <div className="page-empty">
            No employees yet.
            {data.unlinked.length > 0 && <button className="link-btn" onClick={() => setModal({ employee: null })}>Add first employee →</button>}
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr><th>Name</th><th>Type</th><th>Pay Basis</th><th className="num">Rate / Salary</th><th>Filing</th><th>State</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {data.employees.map((e) => (
                  <tr key={e.id} style={{ opacity: e.active ? 1 : 0.5 }}>
                    <td>{e.first_name} {e.last_name}{e.email && <div className="text-muted" style={{ fontSize: '0.72rem' }}>{e.email}</div>}</td>
                    <td><span className={`badge ${e.employee_type === 'w2' ? 'badge-blue' : 'badge-orange'}`}>{e.employee_type === 'w2' ? 'W-2' : '1099'}</span></td>
                    <td style={{ textTransform: 'capitalize' }}>{e.pay_basis}</td>
                    <td className="num">
                      {e.pay_basis === 'salary' ? `${fmt(e.salary_annual)}/yr`
                        : e.pay_basis === 'hourly' || e.pay_basis === 'hybrid' ? `${fmt(e.hourly_rate)}/hr`
                        : `${((e.commission_rate || 0.45) * 100).toFixed(0)}%`}
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{e.filing_status || 'single'}</td>
                    <td>{e.state_code || '—'}</td>
                    <td><span className={`badge ${e.active ? 'badge-green' : 'badge-gray'}`}>{e.active ? 'Active' : 'Inactive'}</span></td>
                    <td><button className="link-btn" onClick={() => setModal({ employee: e })}>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <EmployeeModal
          employee={modal.employee}
          unlinked={data.unlinked}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}
