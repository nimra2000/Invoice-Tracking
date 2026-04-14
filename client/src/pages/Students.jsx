import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function StudentForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || { name: '', email: '' });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ name: form.name, email: form.email });
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
      <button className="btn btn-primary" type="submit">{initial ? 'Save Changes' : 'Add Student'}</button>
      <button className="btn btn-secondary" type="button" onClick={onCancel}>Cancel</button>
    </form>
  );
}

export default function Students() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [adding, setAdding] = useState(false);

  const load = () => fetch('/api/students').then((r) => r.json()).then(setStudents);
  useEffect(() => { load(); }, []);

  const handleAdd = async (data) => {
    await fetch('/api/students', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
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

  return (
    <div className="page">
      <div className="card-row" style={{ marginBottom: 20 }}>
        <span className="page-title" style={{ marginBottom: 0 }}>Students</span>
        <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>+ Add</button>
      </div>
      {students.length === 0 && <div className="empty">No students yet.<br />Tap + Add to get started.</div>}
      {students.map((s) => (
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
