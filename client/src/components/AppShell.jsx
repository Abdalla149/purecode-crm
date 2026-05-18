import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, UserCheck, BarChart2,
  List, Flame, Phone, TrendingUp, LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSidebarCounts } from '../context/SidebarCounts';

const ADMIN_NAV = [
  { to: '/dashboard',  label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/all-leads',  label: 'All Leads',  Icon: Users },
  { to: '/agents',     label: 'Agents',     Icon: UserCheck },
  { to: '/reports',    label: 'Reports',    Icon: BarChart2 },
];

const AGENT_NAV_MAIN = [
  { to: '/my-queue',   label: 'My Queue',   Icon: List },
  { to: '/hot-leads',  label: 'Hot Leads',  Icon: Flame },
  { to: '/callbacks',  label: 'Callbacks',  Icon: Phone },
  { to: '/my-stats',   label: 'My Stats',   Icon: TrendingUp },
];

const AGENT_NAV_RESOURCES = [
  { to: '/scripts',              label: '📖 Scripts & Objections' },
  { to: '/scripts?tab=objections', label: '💡 Quick Objections' },
];

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/all-leads': 'All Leads',
  '/agents':    'Agents',
  '/reports':   'Reports',
  '/my-queue':  'My Queue',
  '/hot-leads': 'Hot Leads',
  '/callbacks': 'Callbacks',
  '/my-stats':  'My Stats',
  '/scripts':   'Scripts & Objections',
  '/resources': 'Scripts & Objections',
};

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = user?.role === 'admin' ? ADMIN_NAV : AGENT_NAV_MAIN;
  const { counts } = useSidebarCounts();
  const pageTitle = PAGE_TITLES[location.pathname] ?? '';
  const initials = user?.name?.charAt(0).toUpperCase() ?? '?';

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      {/* ── Topbar ── */}
      <header className="app-topbar">
        <span className="app-brand">PURECODE</span>
        <div className="app-sep" />
        <span className="app-page-title">{pageTitle}</span>

        <div className="app-topbar-right">
          <div className="user-chip">
            <span className={`user-chip-av ${user?.role}`}>{initials}</span>
            {user?.name}
          </div>
          <button
            className="logout-btn"
            onClick={handleLogout}
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="app-body">
        {/* ── Sidebar ── */}
        <nav className="app-sidebar">
          <div className="nav-section">Main</div>
          {navItems.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon"><Icon size={13} /></span>
              {label}
              {counts[to] > 0 && (
                <span className="badge">{counts[to]}</span>
              )}
            </NavLink>
          ))}

          {user?.role === 'agent' && (
            <>
              <div className="nav-section" style={{ marginTop: 12 }}>Resources</div>
              {AGENT_NAV_RESOURCES.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                >
                  {label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* ── Page content ── */}
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
