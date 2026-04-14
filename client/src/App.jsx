import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import Students from './pages/Students';
import StudentDetail from './pages/StudentDetail';
import StudentEdit from './pages/StudentEdit';
import LogLesson from './pages/LogLesson';
import Invoices from './pages/Invoices';
import Profile from './pages/Profile';
import Login from './pages/Login';

const PersonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
);
const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
  </svg>
);
const InvoiceIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="12" y2="15"/>
  </svg>
);
const ProfileIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/><circle cx="12" cy="8" r="1.5" fill="currentColor" stroke="none"/>
  </svg>
);

export default function App() {
  const [user, setUser] = useState(undefined);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/auth/me', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((u) => {
        setUser(u);
        if (u) {
          fetch('/api/profile').then((r) => r.json()).then((p) => {
            if (!p?.name) setProfileIncomplete(true);
          });
        }
      })
      .catch(() => setUser(null));
  }, []);

  if (user === undefined) return null;
  if (!user) return <Login />;

  const handleLogout = async () => {
    await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
  };

  return (
    <>
      {profileIncomplete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 340, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Welcome! Set up your profile</div>
            <div style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>
              Your name and contact info appear at the top of every invoice. Take a moment to fill it in before sending your first one.
            </div>
            <button
              className="btn btn-primary"
              style={{ width: '100%', marginBottom: 10 }}
              onClick={() => { setProfileIncomplete(false); navigate('/profile'); }}
            >
              Set Up Profile
            </button>
            <button
              className="btn btn-secondary"
              style={{ width: '100%' }}
              onClick={() => setProfileIncomplete(false)}
            >
              Remind me later
            </button>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
        <span style={{ fontWeight: 700, fontSize: 17 }}>Coach App</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {user.picture && <img src={user.picture} style={{ width: 28, height: 28, borderRadius: '50%' }} alt="" />}
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>Sign out</button>
        </div>
      </div>
      <Routes>
        <Route path="/" element={<Students />} />
        <Route path="/students/:id" element={<StudentDetail />} />
        <Route path="/students/:id/edit" element={<StudentEdit />} />
        <Route path="/log" element={<LogLesson />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
      <nav className="bottom-nav">
        <NavLink to="/" end><PersonIcon />Students</NavLink>
        <NavLink to="/log"><PlusIcon />Log</NavLink>
        <NavLink to="/invoices"><InvoiceIcon />Invoices</NavLink>
        <NavLink to="/profile"><ProfileIcon />Profile</NavLink>
      </nav>
    </>
  );
}
