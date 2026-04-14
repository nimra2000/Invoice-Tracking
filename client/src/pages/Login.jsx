export default function Login() {
  const handleLogin = () => {
    window.location.href = '/auth/google';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', padding: 32, gap: 24 }}>
      <div style={{ fontSize: 48 }}>🏅</div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>Coach App</div>
      <div style={{ color: '#6b7280', fontSize: 15, textAlign: 'center' }}>
        Track lessons and send invoices to your students.
      </div>
      <button
        onClick={handleLogin}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: '#fff', border: '1px solid #d1d5db',
          borderRadius: 10, padding: '14px 24px',
          fontSize: 16, fontWeight: 600, cursor: 'pointer',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 48 48">
          <path fill="#4285F4" d="M44.5 20H24v8.5h11.7C34.2 33.6 29.6 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6-6C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.9 0 20-7.9 20-21 0-1.4-.1-2.7-.5-4z"/>
          <path fill="#34A853" d="M6.3 14.7l7 5.1C15 16.1 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6-6C34.6 5.1 29.6 3 24 3 16.3 3 9.7 7.9 6.3 14.7z"/>
          <path fill="#FBBC05" d="M24 45c5.5 0 10.5-1.9 14.4-5l-6.7-5.5C29.6 36 26.9 37 24 37c-5.6 0-10.3-3.5-11.8-8.4l-7 5.4C8.6 40.9 15.8 45 24 45z"/>
          <path fill="#EA4335" d="M44.5 20H24v8.5h11.7c-.8 2.3-2.3 4.2-4.2 5.5l6.7 5.5C41.8 36.2 45 30.6 45 24c0-1.4-.2-2.7-.5-4z"/>
        </svg>
        Sign in with Google
      </button>
    </div>
  );
}
