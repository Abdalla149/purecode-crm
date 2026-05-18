import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { getHomeRoute } from './utils/auth';

import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './components/AppShell';
import { SidebarCountsProvider } from './context/SidebarCounts';
import { RealtimeFeedProvider } from './context/RealtimeFeed';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AllLeads from './pages/AllLeads';
import Agents from './pages/Agents';
import Reports from './pages/Reports';
import MyQueue from './pages/MyQueue';
import HotLeads from './pages/HotLeads';
import Callbacks from './pages/Callbacks';
import MyStats from './pages/MyStats';
import Resources from './pages/Resources';

function RootRedirect() {
  const { token, user } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <Navigate to={getHomeRoute(user?.role)} replace />;
}

export default function App() {
  return (
    <SidebarCountsProvider>
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />

      {/* Admin-only section */}
      <Route element={<ProtectedRoute requiredRole="admin" />}>
        <Route element={<RealtimeFeedProvider><AppShell /></RealtimeFeedProvider>}>
          <Route path="/dashboard"  element={<Dashboard />} />
          <Route path="/all-leads"  element={<AllLeads />} />
          <Route path="/agents"     element={<Agents />} />
          <Route path="/reports"    element={<Reports />} />
        </Route>
      </Route>

      {/* Agent section (all authenticated users) */}
      <Route element={<ProtectedRoute />}>
        <Route element={<RealtimeFeedProvider><AppShell /></RealtimeFeedProvider>}>
          <Route path="/my-queue"   element={<MyQueue />} />
          <Route path="/hot-leads"  element={<HotLeads />} />
          <Route path="/callbacks"  element={<Callbacks />} />
          <Route path="/my-stats"   element={<MyStats />} />
          <Route path="/scripts"    element={<Resources />} />
          <Route path="/resources"  element={<Resources />} />
        </Route>
      </Route>

      {/* Catch-all */}
      <Route path="/"   element={<RootRedirect />} />
      <Route path="*"   element={<Navigate to="/" replace />} />
    </Routes>
    </SidebarCountsProvider>
  );
}
