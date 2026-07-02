import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import * as api from './api';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import FinancialPage from './pages/FinancialPage';
import PayrollIndexPage from './pages/PayrollIndexPage';
import PayrollEmployeesPage from './pages/PayrollEmployeesPage';
import PayrollRunPage from './pages/PayrollRunPage';
import PayrollStubsPage from './pages/PayrollStubsPage';
import PayrollReportsPage from './pages/PayrollReportsPage';

export default function AppRouter() {
  const [me, setMe] = useState(undefined); // undefined = loading, null = logged out, obj = logged in

  const refreshMe = useCallback(() => {
    api.getMe().then(setMe).catch(() => setMe(null));
  }, []);

  useEffect(() => { refreshMe(); }, [refreshMe]);

  const handleLogout = async () => {
    await api.logout().catch(() => {});
    setMe(null);
  };

  if (me === undefined) {
    return <div className="page-loading">Loading…</div>;
  }

  if (!me) {
    return <LoginPage onLoggedIn={refreshMe} />;
  }

  return (
    <div className="admin-layout">
      <Sidebar me={me} onLogout={handleLogout} />
      <main className="admin-content">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/financial" element={<FinancialPage />} />
          <Route path="/payroll" element={<PayrollIndexPage />} />
          <Route path="/payroll/employees" element={<PayrollEmployeesPage />} />
          <Route path="/payroll/run" element={<PayrollRunPage />} />
          <Route path="/payroll/run/:runId/stubs" element={<PayrollStubsPage />} />
          <Route path="/payroll/reports" element={<PayrollReportsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
