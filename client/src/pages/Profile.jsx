import { useState, useEffect } from 'react';

export default function Profile() {
  const DEFAULT_TEMPLATE = 'Hi {name},\n\nPlease find attached your invoice for {month}.\n\nTotal Amount Due: ${total}\n\nThank you!';
  const [form, setForm] = useState({ name: '', address: '', phone: '', email: '', email_template: '' });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/profile').then((r) => r.json()),
      fetch('/auth/me', { credentials: 'include' }).then((r) => r.json()),
    ]).then(([profile, user]) => {
      setForm({
        name: profile?.name || '',
        address: profile?.address || '',
        phone: profile?.phone || '',
        email: profile?.email || user?.email || '',
        email_template: profile?.email_template || DEFAULT_TEMPLATE,
      });
    }).catch(() => {
      fetch('/auth/me', { credentials: 'include' }).then((r) => r.json()).then((user) => {
        setForm((f) => ({ ...f, email: f.email || user?.email || '' }));
      });
    });
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="page">
      <div className="page-title">My Profile</div>
      <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 20 }}>
        This information appears at the top of every invoice.
      </div>

      {saved && (
        <div style={{ background: '#dcfce7', color: '#15803d', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontWeight: 600 }}>
          Profile saved!
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Full Name</label>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Jane Smith" required />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="you@gmail.com" />
        </div>
        <div className="form-group">
          <label>Address</label>
          <input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="123 Main St, City, Province" />
        </div>
        <div className="form-group">
          <label>Phone Number</label>
          <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(416) 555-0100" />
        </div>
        <div className="form-group">
          <label>Invoice Email Message</label>
          <textarea
            rows={6}
            value={form.email_template}
            onChange={(e) => set('email_template', e.target.value)}
            placeholder=""
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }}
          />
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
            Use <strong>{'{name}'}</strong>, <strong>{'{month}'}</strong>, <strong>{'{total}'}</strong> as placeholders.
          </div>
        </div>
        <button className="btn btn-primary" type="submit">{saved ? 'Saved!' : 'Save Profile'}</button>
      </form>
    </div>
  );
}
