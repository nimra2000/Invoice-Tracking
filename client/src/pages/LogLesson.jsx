import { useState, useEffect } from 'react';

const TYPES = ['private', 'semi_private', 'group'];
const TYPE_LABELS = { private: 'Private', semi_private: 'Semi-Private', group: 'Group' };

const today = () => new Date().toISOString().slice(0, 10);

function formatDuration(mins) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

function Stepper({ value, onChange, step = 15, min = 15, duration = false }) {
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(value + step);
  return (
    <div className="stepper">
      <button type="button" onClick={dec}>−</button>
      <span>{duration ? formatDuration(value) : value}</span>
      <button type="button" onClick={inc}>+</button>
    </div>
  );
}

export default function LogLesson() {
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState({ student_id: '', date: today(), type: 'private', duration_mins: 60, rate_per_hour: '', num_students: 1 });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/students')
      .then((r) => r.json())
      .then((data) => {
        setStudents(data);
        if (data.length > 0) setForm((f) => ({ ...f, student_id: data[0].id }));
      });
    fetch('/api/profile')
      .then((r) => r.json())
      .then((profile) => {
        if (profile?.default_rate) setForm((f) => ({ ...f, rate_per_hour: profile.default_rate }));
      })
      .catch(() => {});
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleTypeChange = (type) => {
    const num_students = type === 'semi_private' ? 2 : type === 'private' ? 1 : form.num_students < 2 ? 2 : form.num_students;
    setForm((f) => ({ ...f, type, num_students }));
  };

  const rate = Number(form.rate_per_hour || 0);
  const perStudentRate = form.num_students > 1 ? rate / form.num_students : rate;
  const amount = (form.duration_mins / 60) * perStudentRate;

  const handleSubmit = async (e) => {
    e.preventDefault();
    await fetch('/api/lessons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: Number(form.student_id),
        date: form.date,
        type: form.type,
        duration_mins: Number(form.duration_mins),
        rate_per_hour: Number(form.rate_per_hour),
        num_students: Number(form.num_students),
      }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setForm((f) => ({ ...f, date: today(), duration_mins: 60, rate_per_hour: '', num_students: 1, type: 'private' }));
  };

  if (students.length === 0) {
    return (
      <div className="page">
        <div className="page-title">Log Lesson</div>
        <div className="empty">No students yet.<br />Add a student first.</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-title">Log Lesson</div>
      {saved && (
        <div style={{ background: '#dcfce7', color: '#15803d', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontWeight: 600 }}>
          Lesson saved!
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Student</label>
          <select value={form.student_id} onChange={(e) => set('student_id', e.target.value)}>
            {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
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
          <Stepper value={form.duration_mins} onChange={(v) => set('duration_mins', v)} duration />
        </div>
        <div className="form-group">
          <label>Rate ($/hr)</label>
          <input type="number" min="0" step="0.01" value={form.rate_per_hour} onChange={(e) => set('rate_per_hour', e.target.value)} placeholder="0.00" required />
        </div>

        {form.type === 'group' && (
          <div className="form-group">
            <label>Number of Students in Group</label>
            <Stepper value={form.num_students} onChange={(v) => set('num_students', Math.max(2, v))} step={1} min={2} duration={false} />
          </div>
        )}

        {form.type === 'semi_private' && (
          <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>
            Split between 2 students — each pays ${perStudentRate.toFixed(2)}/hr
          </div>
        )}

        {form.rate_per_hour !== '' && (
          <div style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 15 }}>
            {form.num_students > 1
              ? <>Per-student amount: <strong>${amount.toFixed(2)}</strong> <span style={{ color: '#6b7280', fontSize: 13 }}>(${rate.toFixed(2)}/hr ÷ {form.num_students})</span></>
              : <>Amount: <strong>${amount.toFixed(2)}</strong></>
            }
          </div>
        )}

        <button className="btn btn-primary" type="submit">Save Lesson</button>
      </form>
    </div>
  );
}
