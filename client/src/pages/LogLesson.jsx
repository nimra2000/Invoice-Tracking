import { useState, useEffect, useRef } from 'react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const today = () => new Date().toISOString().slice(0, 10);

function formatDuration(mins) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

function Stepper({ value, onChange, step = 15, min = 15, duration = false }) {
  return (
    <div className="stepper">
      <button type="button" onClick={() => onChange(Math.max(min, value - step))}>−</button>
      <span>{duration ? formatDuration(value) : value}</span>
      <button type="button" onClick={() => onChange(value + step)}>+</button>
    </div>
  );
}

// Tag-style multi-student picker
function SkaterPicker({ students, value, onChange }) {
  const [search, setSearch] = useState('');
  const filtered = students.filter(
    (s) => !value.includes(s.id) && s.name.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
        {value.map((id) => {
          const s = students.find((s) => s.id === id);
          return s ? (
            <span key={id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#e0f2fe', color: '#0369a1', borderRadius: 20, padding: '3px 10px', fontSize: 13, fontWeight: 500 }}>
              {s.name}
              <button type="button" onClick={() => onChange(value.filter((v) => v !== id))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0369a1', fontSize: 15, padding: 0, lineHeight: 1 }}>×</button>
            </span>
          ) : null;
        })}
      </div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search student to add…"
        style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}
      />
      {search && filtered.length > 0 && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, marginTop: 4, overflow: 'hidden' }}>
          {filtered.map((s) => (
            <div key={s.id} onClick={() => { onChange([...value, s.id]); setSearch(''); }}
              style={{ padding: '9px 12px', cursor: 'pointer', fontSize: 14, background: '#fff', borderBottom: '1px solid #f3f4f6' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f0f9ff'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}>
              {s.name}
            </div>
          ))}
        </div>
      )}
      {search && filtered.length === 0 && (
        <div style={{ color: '#9ca3af', fontSize: 13, marginTop: 4 }}>No matching students</div>
      )}
    </div>
  );
}

const emptyForm = (defaultRate = '') => ({
  label: '',
  notes: '',
  skater_ids: [],
  mode: 'once',
  // once fields
  date: today(),
  // recurring fields
  day_of_week: 1,
  effective_from: today(),
  effective_until: '',
  // common
  start_time: '',
  duration_mins: 60,
  billing_type: 'hourly',
  lesson_type: 'private',
  rate_per_hour: defaultRate,
  flat_amount: '',
  custom_label: '',
});

export default function LogLesson() {
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [saved, setSaved] = useState(false);
  const [defaultRate, setDefaultRate] = useState('');
  const pageRef = useRef(null);

  useEffect(() => {
    fetch('/api/students').then((r) => r.json()).then((data) => setStudents(Array.isArray(data) ? data : []));
    fetch('/api/profile').then((r) => r.json()).then((p) => {
      if (p?.default_rate) {
        setDefaultRate(p.default_rate);
        setForm((f) => ({ ...f, rate_per_hour: p.default_rate }));
      }
    }).catch(() => {});
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const isHourly = form.billing_type === 'hourly';
  const skaterCount = form.skater_ids.length || 1;
  const perStudentRate = isHourly ? Number(form.rate_per_hour || 0) / skaterCount : 0;
  const previewAmount = isHourly
    ? (form.duration_mins / 60) * perStudentRate
    : Number(form.flat_amount || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.skater_ids.length === 0) return;

    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: form.label || null,
        notes: form.notes || null,
        skater_ids: form.skater_ids,
        recurring: form.mode === 'recurring',
        day_of_week: form.mode === 'recurring' ? Number(form.day_of_week) : null,
        date: form.mode === 'once' ? form.date : null,
        effective_from: form.mode === 'recurring' ? form.effective_from : form.date,
        effective_until: form.mode === 'recurring' ? (form.effective_until || null) : null,
        start_time: form.start_time || null,
        duration_mins: form.duration_mins ? Number(form.duration_mins) : null,
        billing_type: form.billing_type,
        lesson_type: form.lesson_type,
        rate_per_hour: isHourly ? Number(form.rate_per_hour || 0) : null,
        flat_amount: !isHourly ? Number(form.flat_amount || 0) : null,
        custom_label: form.billing_type === 'custom' ? form.custom_label : null,
      }),
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    setForm(emptyForm(defaultRate));
    pageRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (students.length === 0) {
    return (
      <div className="page">
        <div className="page-title">Add a Charge</div>
        <div className="empty">No students yet.<br />Add a student first.</div>
      </div>
    );
  }

  return (
    <div className="page" ref={pageRef}>
      <div className="page-title">Add a Charge</div>
      {saved && (
        <div style={{ background: '#dcfce7', color: '#15803d', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontWeight: 600 }}>
          Charge saved!
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Event Label <span style={{ fontWeight: 400, color: '#6b7280', fontSize: 13 }}>(optional)</span></label>
          <input value={form.label} onChange={(e) => set('label', e.target.value)} placeholder="e.g. Skating lesson" />
        </div>

        <div className="form-group">
          <label>Students</label>
          <SkaterPicker students={students} value={form.skater_ids} onChange={(ids) => set('skater_ids', ids)} />
        </div>

        {/* Recurring vs One-time */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 16, border: '1px solid #d1d5db', borderRadius: 8, overflow: 'hidden' }}>
          {['once', 'recurring'].map((m) => (
            <button key={m} type="button" onClick={() => set('mode', m)}
              style={{ flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
                background: form.mode === m ? '#2563eb' : '#fff', color: form.mode === m ? '#fff' : '#374151' }}>
              {m === 'once' ? 'One-time' : 'Recurring'}
            </button>
          ))}
        </div>

        {form.mode === 'once' ? (
          <div className="form-group">
            <label>Date</label>
            <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} required />
          </div>
        ) : (
          <>
            <div className="form-group">
              <label>Day of Week</label>
              <select value={form.day_of_week} onChange={(e) => set('day_of_week', Number(e.target.value))}>
                {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>Start date</label>
                <input type="date" value={form.effective_from} onChange={(e) => set('effective_from', e.target.value)} required />
              </div>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>End date <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: 12 }}>(opt.)</span></label>
                <input type="date" value={form.effective_until} onChange={(e) => set('effective_until', e.target.value)} />
              </div>
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label>Start time <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: 12 }}>(opt.)</span></label>
            <input type="time" value={form.start_time} onChange={(e) => set('start_time', e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label>Duration</label>
            <Stepper value={form.duration_mins} onChange={(v) => set('duration_mins', v)} duration />
          </div>
        </div>

        <div className="form-group">
          <label>Charge Type</label>
          <select value={form.billing_type} onChange={(e) => set('billing_type', e.target.value)}>
            <option value="hourly">Hourly Rate</option>
            <option value="flat_fee">Flat Fee</option>
            <option value="choreography">Choreography</option>
            <option value="competition_fee">Competition Fee</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        {isHourly ? (
          <>
            <div className="form-group">
              <label>Lesson Type</label>
              <select value={form.lesson_type} onChange={(e) => set('lesson_type', e.target.value)}>
                <option value="private">Private</option>
                <option value="semi_private">Semi-Private</option>
                <option value="group">Group</option>
              </select>
            </div>
            <div className="form-group">
              <label>Rate ($/hr)</label>
              <input type="number" min="0" step="0.01" value={form.rate_per_hour} onChange={(e) => set('rate_per_hour', e.target.value)} placeholder="0.00" required />
            </div>
            {form.skater_ids.length > 1 && form.rate_per_hour && (
              <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>
                ${Number(form.rate_per_hour).toFixed(2)}/hr ÷ {form.skater_ids.length} students = ${perStudentRate.toFixed(2)}/hr each
              </div>
            )}
          </>
        ) : (
          <>
            {form.billing_type === 'custom' && (
              <div className="form-group">
                <label>Label</label>
                <input value={form.custom_label} onChange={(e) => set('custom_label', e.target.value)} placeholder="e.g. Costume fee" required />
              </div>
            )}
            <div className="form-group">
              <label>Amount per student ($)</label>
              <input type="number" min="0" step="0.01" value={form.flat_amount} onChange={(e) => set('flat_amount', e.target.value)} placeholder="0.00" required />
            </div>
          </>
        )}

        {(previewAmount > 0) && (
          <div style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 15 }}>
            Per-student amount: <strong>${previewAmount.toFixed(2)}</strong>
          </div>
        )}

        <div className="form-group">
          <label>Notes <span style={{ fontWeight: 400, color: '#6b7280', fontSize: 13 }}>(optional — appears on invoice)</span></label>
          <textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)}
            placeholder="e.g. Worked on double axel"
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }} />
        </div>

        <button className="btn btn-primary" type="submit" disabled={form.skater_ids.length === 0}>
          {saved ? 'Saved!' : 'Save Charge'}
        </button>
      </form>
    </div>
  );
}
