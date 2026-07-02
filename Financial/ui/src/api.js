/**
 * api.js — Financial backend client.
 * All calls go through the Vite proxy (/fin-api → localhost:5002/api).
 */

async function request(path, options = {}) {
  const res = await fetch(`/fin-api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'API error');
  }
  return res.json();
}

// ── Auth ─────────────────────────────────────────────────────────────
export const login = (username, password) =>
  request('/login', { method: 'POST', body: JSON.stringify({ username, password }) });

export const logout = () => request('/logout', { method: 'POST' });

export const getMe = () => request('/me');

// ── Dashboard ────────────────────────────────────────────────────────
export const getDashboard = () => request('/dashboard');

// ── Financial ────────────────────────────────────────────────────────
export const getFinancial = () => request('/financial');

export const addExpense = (expense) =>
  request('/financial/expenses', { method: 'POST', body: JSON.stringify(expense) });

export const deleteExpense = (id) =>
  request(`/financial/expenses/${id}`, { method: 'DELETE' });

// ── Payroll ──────────────────────────────────────────────────────────
export const getPayrollIndex = () => request('/payroll');

export const getEmployees = () => request('/payroll/employees');

export const saveEmployee = (employee) =>
  request('/payroll/employees', { method: 'POST', body: JSON.stringify(employee) });

export const getDefaultPeriod = () => request('/payroll/run/default-period');

export const previewPayroll = (periodStart, periodEnd) =>
  request('/payroll/run/preview', {
    method: 'POST',
    body: JSON.stringify({ period_start: periodStart, period_end: periodEnd }),
  });

export const savePayroll = (periodStart, periodEnd, entries) =>
  request('/payroll/run/save', {
    method: 'POST',
    body: JSON.stringify({ period_start: periodStart, period_end: periodEnd, entries }),
  });

export const getStubs = (runId) => request(`/payroll/run/${runId}/stubs`);

export const approveRun = (runId) => request(`/payroll/run/${runId}/approve`, { method: 'POST' });

export const voidRun = (runId) => request(`/payroll/run/${runId}/void`, { method: 'POST' });

export const getPayrollReports = () => request('/payroll/reports');
