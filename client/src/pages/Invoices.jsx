import { useState, useEffect, useRef } from 'react';

const currentMonth = () => new Date().toISOString().slice(0, 7);
const HST_RATE = 0.13;

const BILLING_LABELS = {
  hourly: 'Hourly',
  flat_fee: 'Flat Fee',
  choreography: 'Choreography',
  competition_fee: 'Competition Fee',
  custom: 'Custom',
};
const LESSON_LABELS = { private: 'Private', semi_private: 'Semi-Private', group: 'Group' };

function perSkaterAmount(charge) {
  if (!charge.billing_type || charge.billing_type === 'hourly') {
    const mins = charge.duration_mins || 0;
    const skaters = (charge.skater_ids || []).length || 1;
    return (mins / 60) * (charge.rate_per_hour || 0) / skaters;
  }
  return Number(charge.flat_amount || 0);
}

function StudentSearch({ students, selectedId, onSelect }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const selected = students.find((s) => String(s.id) === selectedId);
  const sorted = [...students].sort((a, b) => a.name.localeCompare(b.name));
  const filtered = sorted.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const handleSelect = (s) => { onSelect(String(s.id)); setQuery(''); setOpen(false); };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {selected && !open ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff' }}>
          <span style={{ fontSize: 16, fontWeight: 500 }}>{selected.name}</span>
          <button type="button" onClick={() => { setOpen(true); setQuery(''); }}
            style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
            Change
          </button>
        </div>
      ) : (
        <input
          autoFocus={open}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search student…"
          style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 16 }}
        />
      )}
      {open && query.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, marginTop: 4, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', maxHeight: 240, overflowY: 'auto' }}>
          {filtered.length === 0
            ? <div style={{ padding: '10px 14px', fontSize: 14, color: '#9ca3af' }}>No matches</div>
            : filtered.map((s) => {
              const isSel = String(s.id) === selectedId;
              return (
                <div key={s.id} onClick={() => handleSelect(s)}
                  style={{ padding: '12px 14px', fontSize: 15, cursor: 'pointer', borderBottom: '1px solid #f3f4f6', background: isSel ? '#eff6ff' : '#fff', color: isSel ? '#2563eb' : '#111827', fontWeight: isSel ? 600 : 400 }}
                  onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = '#f9fafb'; }}
                  onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = '#fff'; }}>
                  {s.name}
                </div>
              );
            })
          }
        </div>
      )}
    </div>
  );
}

export default function Invoices() {
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [month, setMonth] = useState(currentMonth());
  const [charges, setCharges] = useState([]);
  const [applyHst, setApplyHst] = useState(false);
  const [balance, setBalance] = useState('');
  const [customCharges, setCustomCharges] = useState([]);
  const [applyBalance, setApplyBalance] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null);
  const [expandedKey, setExpandedKey] = useState(null);
  const [skipped, setSkipped] = useState(new Set());
  const [lastSent, setLastSent] = useState(null);

  useEffect(() => {
    fetch('/api/students').then((r) => r.json()).then((data) => {
      setStudents(data);
      if (data.length > 0) setSelectedStudent(String(data[0].id));
    });
  }, []);

  const skipStorageKey = (sid, m) => `invoice-skipped-${sid}-${m}`;

  useEffect(() => {
    if (!selectedStudent) return;
    fetch(`/api/events/charges?student_id=${selectedStudent}&month=${month}`)
      .then((r) => r.json())
      .then((data) => {
        setCharges(Array.isArray(data) ? data : []);
        const stored = localStorage.getItem(skipStorageKey(selectedStudent, month));
        setSkipped(stored ? new Set(JSON.parse(stored)) : new Set());
        setExpandedKey(null);
      });
  }, [selectedStudent, month]);

  useEffect(() => {
    if (!selectedStudent) return;
    fetch(`/api/students/${selectedStudent}/balance`)
      .then((r) => r.json())
      .then((entries) => {
        const outstanding = entries.filter((e) => !e.settled).reduce((s, e) => s + e.amount, 0);
        setBalance(outstanding || '');
        setApplyBalance(outstanding !== 0);
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

  const chargeKey = (c) => `${c.event_id}-${c.occurrence_date}`;

  const handleStudentChange = (id) => {
    setSelectedStudent(id);
    setBalance('');
    setApplyBalance(false);
    setStatus(null);
  };

  const confirmedCharges = charges.filter((c) => !skipped.has(chargeKey(c)));
  const chargesSubtotal = confirmedCharges.reduce((sum, c) => sum + perSkaterAmount(c), 0);
  const customTotal = customCharges.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const hstAmount = applyHst ? (chargesSubtotal + customTotal) * HST_RATE : 0;
  const balanceNum = applyBalance ? Number(balance || 0) : 0;
  const total = chargesSubtotal + customTotal + hstAmount + balanceNum;

  const addCustomCharge = () => setCustomCharges((c) => [...c, { description: '', amount: '' }]);
  const updateCharge = (i, k, v) => setCustomCharges((c) => c.map((ch, idx) => idx === i ? { ...ch, [k]: v } : ch));
  const removeCharge = (i) => setCustomCharges((c) => c.filter((_, idx) => idx !== i));

  // Convert charges to invoice-compatible lesson format for PDF
  const toInvoiceLessons = (chargeList) => chargeList.map((c) => {
    const skaterCount = (c.skater_ids || []).length || 1;
    if (!c.billing_type || c.billing_type === 'hourly') {
      return {
        date: c.occurrence_date,
        type: c.lesson_type || 'private',
        billing_type: 'hourly',
        duration_mins: c.duration_mins || 0,
        rate_per_hour: (c.rate_per_hour || 0) / skaterCount,
        num_students: 1,
        notes: c.notes || null,
      };
    }
    return {
      date: c.occurrence_date,
      billing_type: c.billing_type,
      flat_amount: c.flat_amount || 0,
      custom_label: c.custom_label || null,
      notes: c.notes || null,
    };
  });

  const handlePreview = () => {
    const params = new URLSearchParams({
      student_id: selectedStudent,
      month,
      apply_hst: applyHst,
      balance: balanceNum,
      custom_charges: JSON.stringify(customCharges.filter((c) => c.description && c.amount)),
      scheduled_lessons: JSON.stringify(toInvoiceLessons(confirmedCharges)),
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
        body: JSON.stringify({
          student_id: Number(selectedStudent),
          month,
          apply_hst: applyHst,
          balance: balanceNum,
          custom_charges: customCharges.filter((c) => c.description && c.amount),
          scheduled_lessons: toInvoiceLessons(confirmedCharges),
        }),
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
        <StudentSearch students={students} selectedId={selectedStudent} onSelect={handleStudentChange} />
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

      {charges.length === 0 ? (
        <div className="empty">No charges for this period.</div>
      ) : (
        <>
          {charges.map((charge, i) => {
            const key = chargeKey(charge);
            const isExpanded = expandedKey === key;
            const isSkipped = skipped.has(key);
            const amt = perSkaterAmount(charge);
            const billingLabel = BILLING_LABELS[charge.billing_type] || charge.billing_type;
            const lessonLabel = LESSON_LABELS[charge.lesson_type] || '';
            const durLabel = (() => {
              const m = charge.duration_mins;
              if (!m) return null;
              return m < 60 ? `${m} min` : m % 60 === 0 ? `${m / 60}h` : `${Math.floor(m / 60)}h ${m % 60}min`;
            })();
            const label = charge.billing_type === 'hourly'
              ? lessonLabel
              : (billingLabel + (charge.custom_label ? ` — ${charge.custom_label}` : ''));

            return (
              <div key={key}>
                <div className="card" style={{ opacity: isSkipped ? 0.4 : 1, cursor: 'pointer' }}
                  onClick={() => setExpandedKey(isExpanded ? null : key)}>
                  <div className="card-row">
                    <div>
                      <div className="card-title">{charge.occurrence_date}{label ? ` · ${label}` : ''}</div>
                      <div className="card-sub">
                        {charge.billing_type === 'hourly'
                          ? <><span className={`tag tag-${charge.lesson_type}`}>{lessonLabel}</span>{durLabel ? ` · ${durLabel}` : ''}</>
                          : <span>{billingLabel}{charge.custom_label ? ` — ${charge.custom_label}` : ''}</span>
                        }
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600 }}>{isSkipped ? '—' : `$${amt.toFixed(2)}`}</span>
                      <span style={{ color: '#9ca3af', fontSize: 18 }}>{isExpanded ? '∨' : '›'}</span>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 12 }}>
                    <div style={{ fontSize: 13, color: '#374151', marginBottom: 8 }}>
                      {charge.billing_type === 'hourly'
                        ? <><strong>{lessonLabel}</strong>{durLabel ? ` · ${durLabel}` : ''}{charge.start_time ? ` · ${formatTime(charge.start_time)}` : ''}{charge.rate_per_hour ? ` · $${(charge.rate_per_hour / ((charge.skater_ids || []).length || 1)).toFixed(2)}/hr each` : ''}</>
                        : <><strong>{billingLabel}</strong>{charge.custom_label ? ` — ${charge.custom_label}` : ''}{` · $${amt.toFixed(2)}`}</>
                      }
                    </div>
                    {charge.notes && (
                      <div style={{ fontSize: 13, color: '#6b7280', fontStyle: 'italic', background: '#fff', border: '1px solid #f3f4f6', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
                        {charge.notes}
                      </div>
                    )}
                    <button
                      className={isSkipped ? 'btn btn-primary' : 'btn btn-secondary'}
                      style={{ width: '100%', padding: '10px' }}
                      onClick={() => {
                        setSkipped((s) => {
                          const next = new Set(s);
                          if (next.has(key)) next.delete(key); else next.add(key);
                          localStorage.setItem(skipStorageKey(selectedStudent, month), JSON.stringify([...next]));
                          return next;
                        });
                        setExpandedKey(null);
                      }}
                    >
                      {isSkipped ? 'Include in Invoice' : 'Skip from Invoice'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Custom Charges */}
          <div style={{ marginBottom: 16, marginTop: 8 }}>
            <div className="card-row" style={{ marginBottom: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Custom Charges</span>
              <button className="btn btn-secondary btn-sm" type="button" onClick={addCustomCharge}>+ Add</button>
            </div>
            {customCharges.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <input placeholder="Description" value={c.description} onChange={(e) => updateCharge(i, 'description', e.target.value)}
                  style={{ flex: 2, padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 15 }} />
                <input type="number" placeholder="$0.00" value={c.amount} onChange={(e) => updateCharge(i, 'amount', e.target.value)}
                  style={{ flex: 1, padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 15 }} />
                <button type="button" onClick={() => removeCharge(i)}
                  style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 20, cursor: 'pointer', padding: '0 4px' }}>×</button>
              </div>
            ))}
          </div>

          {/* HST */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid #e5e7eb' }}>
            <label style={{ fontWeight: 500, fontSize: 15, cursor: 'pointer' }} htmlFor="hst-toggle">Apply HST (13%)</label>
            <input id="hst-toggle" type="checkbox" checked={applyHst} onChange={(e) => setApplyHst(e.target.checked)} style={{ width: 20, height: 20, cursor: 'pointer' }} />
          </div>

          {/* Previous Balance */}
          {Number(balance || 0) !== 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid #e5e7eb' }}>
              <label style={{ fontWeight: 500, fontSize: 15, cursor: 'pointer' }} htmlFor="balance-toggle">
                Apply Outstanding Balance&nbsp;
                <span style={{ color: Number(balance) < 0 ? '#15803d' : '#dc2626', fontWeight: 600 }}>
                  ({Number(balance) < 0 ? `-$${Math.abs(Number(balance)).toFixed(2)}` : `$${Number(balance).toFixed(2)}`})
                </span>
              </label>
              <input id="balance-toggle" type="checkbox" checked={applyBalance} onChange={(e) => setApplyBalance(e.target.checked)} style={{ width: 20, height: 20, cursor: 'pointer' }} />
            </div>
          )}

          {/* Summary */}
          <div style={{ background: '#f9fafb', borderRadius: 8, padding: '14px 16px', marginBottom: 20 }}>
            <Row label="Subtotal" value={chargesSubtotal} />
            {customCharges.filter((c) => c.description && c.amount).map((c, i) => (
              <Row key={i} label={c.description} value={Number(c.amount)} />
            ))}
            {applyHst && <Row label="HST (13%)" value={hstAmount} />}
            {balanceNum !== 0 && (
              <Row label={balanceNum > 0 ? 'Previous Balance (owing)' : 'Previous Balance (credit)'} value={balanceNum} />
            )}
            <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700 }}>
              <span>Total Amount Due</span><span>${total.toFixed(2)}</span>
            </div>
          </div>

          {status === 'sent' && (
            <div style={{ background: '#dcfce7', color: '#15803d', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontWeight: 600 }}>Invoice sent successfully!</div>
          )}
          {status === 'error' && (
            <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontWeight: 600 }}>Failed to send. Check server logs.</div>
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

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
      <span style={{ color: '#374151' }}>{label}</span>
      <span style={{ color: value < 0 ? '#15803d' : '#111827' }}>{value < 0 ? `-$${Math.abs(value).toFixed(2)}` : `$${value.toFixed(2)}`}</span>
    </div>
  );
}
