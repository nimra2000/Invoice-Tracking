import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function StudentForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || { name: '', email: '', billing_name: '' });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ name: form.name, email: form.email, billing_name: form.billing_name || '' });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Name</label>
        <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Full name" required />
      </div>
      <div className="form-group">
        <label>Email</label>
        <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="student@email.com" required />
      </div>
      <div className="form-group">
        <label>Billing Name <span style={{ fontWeight: 400, color: '#6b7280', fontSize: 13 }}>(optional — shown on invoice instead of student name)</span></label>
        <input value={form.billing_name} onChange={(e) => set('billing_name', e.target.value)} placeholder={form.name || 'e.g. Jane Smith (parent)'} />
      </div>
      <button className="btn btn-primary" type="submit">{initial ? 'Save Changes' : 'Add Student'}</button>
      <button className="btn btn-secondary" type="button" onClick={onCancel}>Cancel</button>
    </form>
  );
}

export default function Students() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');

  const load = () => fetch('/api/students').then((r) => r.json()).then(setStudents);
  useEffect(() => { load(); }, []);

  const handleAdd = async (data) => {
    const res = await fetch('/api/students', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (!res.ok) { alert('Failed to save student. Please try again.'); return; }
    setAdding(false);
    load();
  };

  if (adding) {
    return (
      <div className="page">
        <div className="page-title">New Student</div>
        <StudentForm onSave={handleAdd} onCancel={() => setAdding(false)} />
      </div>
    );
  }

  const filtered = students
    .filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="page">
      <div className="card-row" style={{ marginBottom: 16 }}>
        <span className="page-title" style={{ marginBottom: 0 }}>Students</span>
        <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>+ Add</button>
      </div>
      {students.length > 0 && (
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search students…"
          style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 15, marginBottom: 16 }}
        />
      )}
      {students.length === 0 && <div className="empty">No students yet.<br />Tap + Add to get started.</div>}
      {filtered.length === 0 && search && <div className="empty" style={{ padding: '24px 0' }}>No students match "{search}"</div>}
      {filtered.map((s) => (
        <div className="card" key={s.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/students/${s.id}/edit`)}>
          <div className="card-row">
            <div>
              <div className="card-title">{s.name}</div>
              <div className="card-sub">{s.email}</div>
            </div>
            <span style={{ color: '#9ca3af', fontSize: 20 }}>›</span>
          </div>
        </div>
      ))}
    </div>
  );
}
