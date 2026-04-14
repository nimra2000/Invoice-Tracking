import { useState, useEffect } from 'react';

const currentMonth = () => new Date().toISOString().slice(0, 7);
const TYPE_LABELS = { private: 'Private', semi_private: 'Semi-Private', group: 'Group' };
const HST_RATE = 0.13;

export default function Invoices() {
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [student, setStudent] = useState(null);
  const [month, setMonth] = useState(currentMonth());
  const [lessons, setLessons] = useState([]);
  const [applyHst, setApplyHst] = useState(false);
  const [balance, setBalance] = useState('');
  const [customCharges, setCustomCharges] = useState([]);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null);
  const [editingLesson, setEditingLesson] = useState(null);
  const [lastSent, setLastSent] = useState(null);

  useEffect(() => {
    fetch('/api/students').then((r) => r.json()).then((data) => {
      setStudents(data);
      if (data.length > 0) {
        setSelectedStudent(String(data[0].id));
        setStudent(data[0]);
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedStudent) return;
    fetch(`/api/lessons?student_id=${selectedStudent}&month=${month}`)
      .then((r) => r.json())
      .then(setLessons);
  }, [selectedStudent, month]);

  useEffect(() => {
    if (!selectedStudent) return;
    fetch(`/api/students/${selectedStudent}/balance`)
      .then((r) => r.json())
      .then((entries) => {
        const outstanding = entries
          .filter((e) => !e.settled)
          .reduce((s, e) => s + e.amount, 0);
        setBalance(outstanding || '');
      });
  }, [selectedStudent]);

  useEffect(() => {
    if (!selectedStudent || !month) return;
    fetch(`/api/invoices/history?student_id=${selectedStudent}`)
      .then((r) => r.json())
      .then((records) => {
        const match = records.find((r) => r.month === month);
        setLastSent(match || null);
      });
  }, [selectedStudent, month, status]);

  const handleStudentChange = (id) => {
    const s = students.find((s) => String(s.id) === id);
    setSelectedStudent(id);
    setStudent(s);
    setBalance('');
    setStatus(null);
  };

  const perStudentAmount = (l) => {
    const duration_mins = l.duration_mins || Math.round((l.duration_hours || 1) * 60);
    return (duration_mins / 60) * (l.rate_per_hour / (l.num_students || 1));
  };
  const subtotal = lessons.reduce((sum, l) => sum + perStudentAmount(l), 0);
  const customTotal = customCharges.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const hstAmount = applyHst ? (subtotal + customTotal) * HST_RATE : 0;
  const balanceNum = Number(balance || 0);
  const total = subtotal + customTotal + hstAmount + balanceNum;

  const addCustomCharge = () => setCustomCharges((c) => [...c, { description: '', amount: '' }]);
  const updateCharge = (i, k, v) => setCustomCharges((c) => c.map((ch, idx) => idx === i ? { ...ch, [k]: v } : ch));
  const removeCharge = (i) => setCustomCharges((c) => c.filter((_, idx) => idx !== i));

  const invoicePayload = () => ({
    student_id: Number(selectedStudent),
    month,
    apply_hst: applyHst,
    balance: balanceNum,
    custom_charges: customCharges.filter((c) => c.description && c.amount),
  });

  const handlePreview = () => {
    const params = new URLSearchParams({
      student_id: selectedStudent,
      month,
      apply_hst: applyHst,
      balance: balanceNum,
      custom_charges: JSON.stringify(customCharges.filter((c) => c.description && c.amount)),
    });
    window.open(`/api/invoices/preview?${params}`, '_blank');
  };

  const handleSend = async () => {
    setSending(true);
    setStatus(null);
    try {
      const res = await fetch('/api/invoices/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoicePayload()),
      });
      const data = await res.json();
      setStatus(data.success ? 'sent' : 'error');
    } catch {
      setStatus('error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="page">
      <div className="page-title">Invoices</div>

      <div className="form-group">
        <label>Student</label>
        <select value={selectedStudent} onChange={(e) => handleStudentChange(e.target.value)}>
          {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div className="form-group">
        <label>Month</label>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>

      {lastSent && (
        <div style={{ background: '#fefce8', border: '1px solid #fde047', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#713f12' }}>
          Invoice already sent on {new Date(lastSent.sent_at).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })} · ${lastSent.total.toFixed(2)}
        </div>
      )}

      {lessons.length === 0 ? (
        <div className="empty">No lessons for this period.</div>
      ) : (
        <>
          {lessons.map((l) => (
            <div key={l.id}>
              <div className="card" onClick={() => setEditingLesson(editingLesson?.id === l.id ? null : l)} style={{ cursor: 'pointer' }}>
                <div className="card-row">
                  <div>
                    <div className="card-title">{l.date}</div>
                    <div className="card-sub">
                      <span className={`tag tag-${l.type}`}>{TYPE_LABELS[l.type]}</span>
                      {' '}{(() => { const m = l.duration_mins || Math.round((l.duration_hours||1)*60); return m < 60 ? `${m} min` : m % 60 === 0 ? `${m/60}h` : `${Math.floor(m/60)}h ${m%60}min`; })()} &middot; ${(l.rate_per_hour / (l.num_students || 1)).toFixed(2)}/hr
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600 }}>${perStudentAmount(l).toFixed(2)}</span>
                    <span style={{ color: '#9ca3af', fontSize: 18 }}>{editingLesson?.id === l.id ? '∧' : '›'}</span>
                  </div>
                </div>
              </div>
              {editingLesson?.id === l.id && (
                <InlineLessonEdit
                  lesson={editingLesson}
                  onSave={() => {
                    setEditingLesson(null);
                    fetch(`/api/lessons?student_id=${selectedStudent}&month=${month}`).then((r) => r.json()).then(setLessons);
                  }}
                  onDelete={() => {
                    setEditingLesson(null);
                    fetch(`/api/lessons?student_id=${selectedStudent}&month=${month}`).then((r) => r.json()).then(setLessons);
                  }}
                  onCancel={() => setEditingLesson(null)}
                />
              )}
            </div>
          ))}

          {/* Custom Charges */}
          <div style={{ marginBottom: 16 }}>
            <div className="card-row" style={{ marginBottom: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Custom Charges</span>
              <button className="btn btn-secondary btn-sm" type="button" onClick={addCustomCharge}>+ Add</button>
            </div>
            {customCharges.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <input
                  placeholder="Description"
                  value={c.description}
                  onChange={(e) => updateCharge(i, 'description', e.target.value)}
                  style={{ flex: 2, padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 15 }}
                />
                <input
                  type="number"
                  placeholder="$0.00"
                  value={c.amount}
                  onChange={(e) => updateCharge(i, 'amount', e.target.value)}
                  style={{ flex: 1, padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 15 }}
                />
                <button
                  type="button"
                  onClick={() => removeCharge(i)}
                  style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 20, cursor: 'pointer', padding: '0 4px' }}
                >×</button>
              </div>
            ))}
          </div>

          {/* HST */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid #e5e7eb' }}>
            <label style={{ fontWeight: 500, fontSize: 15, cursor: 'pointer' }} htmlFor="hst-toggle">
              Apply HST (13%)
            </label>
            <input
              id="hst-toggle"
              type="checkbox"
              checked={applyHst}
              onChange={(e) => setApplyHst(e.target.checked)}
              style={{ width: 20, height: 20, cursor: 'pointer' }}
            />
          </div>

          {/* Previous Balance (read from student) */}
          {balanceNum !== 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid #e5e7eb', marginBottom: 4, fontSize: 14, color: '#374151' }}>
              <span>Previous Balance</span>
              <span style={{ color: balanceNum < 0 ? '#15803d' : '#dc2626', fontWeight: 500 }}>
                {balanceNum < 0 ? `-$${Math.abs(balanceNum).toFixed(2)}` : `$${balanceNum.toFixed(2)}`}
              </span>
            </div>
          )}

          {/* Summary */}
          <div style={{ background: '#f9fafb', borderRadius: 8, padding: '14px 16px', marginBottom: 20 }}>
            <Row label="Subtotal" value={subtotal} />
            {customCharges.filter((c) => c.description && c.amount).map((c, i) => (
              <Row key={i} label={c.description} value={Number(c.amount)} />
            ))}
            {applyHst && <Row label="HST (13%)" value={hstAmount} />}
            {balanceNum !== 0 && (
              <Row label={balanceNum > 0 ? 'Previous Balance (owing)' : 'Previous Balance (credit)'} value={balanceNum} />
            )}
            <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700 }}>
              <span>Total Amount Due</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          {status === 'sent' && (
            <div style={{ background: '#dcfce7', color: '#15803d', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontWeight: 600 }}>
              Invoice sent successfully!
            </div>
          )}
          {status === 'error' && (
            <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontWeight: 600 }}>
              Failed to send. Check server logs.
            </div>
          )}

          <button className="btn btn-secondary" onClick={handlePreview}>Preview PDF</button>
          <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={handleSend} disabled={sending}>
            {sending ? 'Sending...' : 'Send Invoice via Gmail'}
          </button>
        </>
      )}
    </div>
  );
}

const TYPES = ['private', 'semi_private', 'group'];

function formatDuration(mins) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

function DurationStepper({ value, onChange }) {
  return (
    <div className="stepper">
      <button type="button" onClick={() => onChange(Math.max(15, value - 15))}>−</button>
      <span>{formatDuration(value)}</span>
      <button type="button" onClick={() => onChange(value + 15)}>+</button>
    </div>
  );
}

function InlineLessonEdit({ lesson, onSave, onDelete, onCancel }) {
  const [form, setForm] = useState({
    date: lesson.date,
    type: lesson.type,
    duration_mins: lesson.duration_mins || Math.round((lesson.duration_hours || 1) * 60),
    rate_per_hour: lesson.rate_per_hour,
    num_students: lesson.num_students || 1,
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleTypeChange = (type) => {
    const num_students = type === 'semi_private' ? 2 : type === 'private' ? 1 : form.num_students < 2 ? 2 : form.num_students;
    setForm((f) => ({ ...f, type, num_students }));
  };

  const handleSave = async () => {
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
    <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <div className="form-group">
        <label>Date</label>
        <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
      </div>
      <div className="form-group">
        <label>Type</label>
        <select value={form.type} onChange={(e) => handleTypeChange(e.target.value)}>
          {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label>Duration</label>
        <DurationStepper value={form.duration_mins} onChange={(v) => set('duration_mins', v)} />
      </div>
      <div className="form-group">
        <label>Rate ($/hr)</label>
        <input type="number" min="0" step="0.01" value={form.rate_per_hour} onChange={(e) => set('rate_per_hour', e.target.value)} />
      </div>
      {form.type === 'group' && (
        <div className="form-group">
          <label>Students in group</label>
          <div className="stepper">
            <button type="button" onClick={() => set('num_students', Math.max(2, form.num_students - 1))}>−</button>
            <span>{form.num_students}</span>
            <button type="button" onClick={() => set('num_students', form.num_students + 1)}>+</button>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button className="btn btn-primary" style={{ flex: 1, padding: '10px' }} onClick={handleSave}>Save</button>
        <button className="btn btn-secondary" style={{ flex: 1, padding: '10px' }} onClick={onCancel}>Cancel</button>
        <button className="btn btn-danger" style={{ flex: 1, padding: '10px' }} onClick={handleDelete}>Delete</button>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
      <span style={{ color: '#374151' }}>{label}</span>
      <span style={{ color: value < 0 ? '#15803d' : '#111827' }}>{value < 0 ? `-$${Math.abs(value).toFixed(2)}` : `$${value.toFixed(2)}`}</span>
    </div>
  );
}
