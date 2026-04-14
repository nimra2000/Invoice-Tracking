import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';

const TYPES = ['private', 'semi_private', 'group'];
const TYPE_LABELS = { private: 'Private', semi_private: 'Semi-Private', group: 'Group' };

function numStudentsForType(type) {
  if (type === 'semi_private') return 2;
  if (type === 'private') return 1;
  return 2;
}

function formatDuration(mins) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

function Stepper({ value, onChange, step = 15, min = 15 }) {
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(value + step);
  return (
    <div className="stepper">
      <button type="button" onClick={dec}>−</button>
      <span>{typeof value === 'number' && step >= 15 ? formatDuration(value) : value}</span>
      <button type="button" onClick={inc}>+</button>
    </div>
  );
}

function LessonEditForm({ lesson, onSave, onDelete, onCancel }) {
  const [form, setForm] = useState({
    date: lesson.date,
    type: lesson.type,
    duration_mins: lesson.duration_mins || Math.round((lesson.duration_hours || 1) * 60),
    rate_per_hour: lesson.rate_per_hour,
    num_students: lesson.num_students || numStudentsForType(lesson.type),
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleTypeChange = (type) => {
    setForm((f) => ({ ...f, type, num_students: numStudentsForType(type) }));
  };

  const rate = Number(form.rate_per_hour || 0);
  const perStudentRate = form.num_students > 1 ? rate / form.num_students : rate;
  const amount = (form.duration_mins / 60) * perStudentRate;

  const handleSubmit = async (e) => {
    e.preventDefault();
    await fetch(`/api/lessons/${lesson.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, duration_mins: Number(form.duration_mins), rate_per_hour: Number(form.rate_per_hour), num_students: Number(form.num_students) }),
    });
    onSave();
  };

  const handleDelete = async () => {
    if (!confirm('Delete this lesson?')) return;
    await fetch(`/api/lessons/${lesson.id}`, { method: 'DELETE' });
    onDelete();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Date</label>
        <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} required />
      </div>
      <div className="form-group">
        <label>Lesson Type</label>
        <select value={form.type} onChange={(e) => handleTypeChange(e.target.value)}>
          {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label>Duration</label>
        <Stepper value={form.duration_mins} onChange={(v) => set('duration_mins', v)} step={15} min={15} />
      </div>
      <div className="form-group">
        <label>Base Rate ($/hr)</label>
        <input type="number" min="0" step="0.01" value={form.rate_per_hour} onChange={(e) => set('rate_per_hour', e.target.value)} required />
      </div>

      {form.type === 'group' && (
        <div className="form-group">
          <label>Number of Students in Group</label>
          <Stepper value={form.num_students} onChange={(v) => set('num_students', Math.max(2, v))} step={1} min={2} />
        </div>
      )}

      {form.type === 'semi_private' && (
        <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>
          Split between 2 students — each pays ${perStudentRate.toFixed(2)}/hr
        </div>
      )}

      <div style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 15 }}>
        {form.num_students > 1
          ? <>Per-student amount: <strong>${amount.toFixed(2)}</strong> <span style={{ color: '#6b7280', fontSize: 13 }}>(${rate.toFixed(2)}/hr ÷ {form.num_students})</span></>
          : <>Amount: <strong>${amount.toFixed(2)}</strong></>
        }
      </div>

      <button className="btn btn-primary" type="submit">Save Changes</button>
      <button className="btn btn-secondary" type="button" onClick={onCancel}>Cancel</button>
      <button className="btn btn-danger" type="button" onClick={handleDelete}>Delete Lesson</button>
    </form>
  );
}

export default function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [student, setStudent] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [editing, setEditing] = useState(location.state?.editLesson || null);

  const load = async () => {
    const [s, l] = await Promise.all([
      fetch(`/api/students/${id}`).then((r) => r.json()),
      fetch(`/api/lessons?student_id=${id}`).then((r) => r.json()),
    ]);
    setStudent(s);
    setLessons(l);
  };

  useEffect(() => { load(); }, [id]);

  if (!student) return null;

  if (editing) {
    return (
      <div className="page">
        <div className="page-title">Edit Lesson</div>
        <LessonEditForm
          lesson={editing}
          onSave={() => { setEditing(null); load(); }}
          onDelete={() => { setEditing(null); load(); }}
          onCancel={() => setEditing(null)}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <button
        onClick={() => navigate('/')}
        style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 15, cursor: 'pointer', marginBottom: 12, padding: 0 }}
      >
        ← Students
      </button>
      <div className="card-row" style={{ marginBottom: 20 }}>
        <div>
          <div className="page-title" style={{ marginBottom: 2 }}>{student.name}</div>
          <div style={{ color: '#6b7280', fontSize: 13 }}>{student.email}</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/students/${id}/edit`)}>Edit</button>
      </div>

      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>
        Lessons <span style={{ color: '#9ca3af', fontWeight: 400 }}>({lessons.length})</span>
      </div>

      {lessons.length === 0 && <div className="empty">No lessons yet.</div>}

      {lessons.map((l) => {
        const numStudents = l.num_students || numStudentsForType(l.type);
        const perStudentRate = l.rate_per_hour / numStudents;
        const duration_mins = l.duration_mins || Math.round((l.duration_hours || 1) * 60);
        const amount = (duration_mins / 60) * perStudentRate;
        return (
          <div className="card" key={l.id} onClick={() => setEditing(l)} style={{ cursor: 'pointer' }}>
            <div className="card-row">
              <div>
                <div className="card-title">{l.date}</div>
                <div className="card-sub">
                  <span className={`tag tag-${l.type}`}>{TYPE_LABELS[l.type]}</span>
                  {' '}{formatDuration(duration_mins)} &middot; ${perStudentRate.toFixed(2)}/hr
                  {numStudents > 1 && <span style={{ color: '#9ca3af' }}> ({numStudents} students)</span>}
                </div>
              </div>
              <div style={{ fontWeight: 600 }}>${amount.toFixed(2)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
