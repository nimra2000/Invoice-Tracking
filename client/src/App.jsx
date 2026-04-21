import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Calendar as CalendarIcon,
  FileText,
  Settings as SettingsIcon,
  LogIn,
  LogOut,
  Loader2,
  Menu,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import Dashboard from '@/pages/Dashboard.jsx';
import Skaters from '@/pages/Skaters.jsx';
import Lessons from '@/pages/Lessons.jsx';
import Invoices from '@/pages/Invoices.jsx';
import Settings from '@/pages/Settings.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/skaters', label: 'Skaters', icon: Users },
  { to: '/lessons', label: 'Lessons', icon: CalendarIcon },
  { to: '/invoices', label: 'Invoices', icon: FileText },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

function Sidebar({ onNavigate }) {
  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-full">
      <div className="px-6 py-5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-400 to-cyan-300 flex items-center justify-center text-white text-lg">
          ⛸
        </div>
        <div>
          <div className="font-semibold text-slate-900 text-sm">Lesson Tracking</div>
          <div className="text-xs text-slate-500">Coaching Management</div>
        </div>
      </div>
      <nav className="flex-1 px-3 pt-2 space-y-1">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`
            }
          >
            <Icon className="w-4 h-4" /> {label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={async () => {
            onNavigate?.();
            try { await api.post('/auth/logout', {}); } catch { /* ignore */ }
            window.location.href = '/';
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </nav>
    </aside>
  );
}

function LoginScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50/30 flex items-center justify-center">
      <div className="max-w-sm w-full px-6 text-center">
        <div className="w-14 h-14 mx-auto rounded-xl bg-gradient-to-br from-sky-400 to-cyan-300 flex items-center justify-center text-white text-2xl mb-4">
          ⛸
        </div>
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">Lesson Tracking</h1>
        <p className="text-slate-500 mb-8 text-sm">Sign in to manage your coaching business.</p>
        <Button
          onClick={() => { window.location.href = '/auth/google'; }}
          className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800"
        >
          <LogIn className="w-4 h-4 mr-2" /> Sign in with Google
        </Button>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    api
      .get('/auth/me')
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 h-14 bg-white border-b border-slate-200">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 -ml-2 rounded-lg hover:bg-slate-100"
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-cyan-300 flex items-center justify-center text-white">
          ⛸
        </div>
        <div className="font-semibold text-slate-900 text-sm">Lesson Tracking</div>
      </header>

      <div className="hidden md:block">
        <Sidebar />
      </div>

      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} aria-hidden />
          <div className="relative w-64 max-w-[80%] h-full bg-white flex flex-col shadow-xl">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute right-2 top-2 p-2 rounded-lg hover:bg-slate-100"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/skaters" element={<Skaters />} />
          <Route path="/lessons" element={<Lessons />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
