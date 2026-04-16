import { useState, useEffect, useRef, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

const COLORS = {
  private: '#3b82f6',
  semi_private: '#22c55e',
  group: '#a855f7',
  competition_fee: '#f97316',
  choreography: '#ec4899',
  flat_fee: '#6b7280',
  custom: '#6b7280',
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function occurrenceColor(occ) {
  if (!occ.billing_type || occ.billing_type === 'hourly') return COLORS[occ.lesson_type] || '#6b7280';
  return COLORS[occ.billing_type] || '#6b7280';
}

function occurrenceLabel(occ) {
  if (occ.label) return occ.label;
  if (occ.skater_names && occ.skater_names.length > 0) return occ.skater_names.join(', ');
  return 'Event';
}

function computeEnd(date, start_time, duration_mins) {
  if (!start_time || !duration_mins) return undefined;
  const [h, m] = start_time.split(':').map(Number);
  const totalMins = h * 60 + m + Number(duration_mins);
  const endH = Math.floor(totalMins / 60) % 24;
  const endM = totalMins % 60;
  return `${date}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`;
}

// ---- SkaterPicker ----
function SkaterPicker({ students, value, onChange }) {
  const [search, setSearch] = useState('');
  const filtered = students.filter(
    (s) => !value.includes(s.id) && s.name.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
        {value.map((id) => {
          const s = students.find((s) => s.id === id);
          return s ? (
            <span key={id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#e0f2fe', color: '#0369a1', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 500 }}>
              {s.name}
              <button type="button" onClick={() => onChange(value.filter((v) => v !== id))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0369a1', fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
            </span>
          ) : null;
        })}
      </div>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search skater to add…"
        style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }} />
      {search && filtered.length > 0 && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, marginTop: 3, overflow: 'hidden', background: '#fff' }}>
          {filtered.map((s) => (
            <div key={s.id} onClick={() => { onChange([...value, s.id]); setSearch(''); }}
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f3f4f6' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f0f9ff'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}>
              {s.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- EventForm (edit only) ----
function EventForm({ students, initial, onSave, onCancel, title, saveLabel }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const isHourly = form.billing_type === 'hourly';

  const handleSave = async () => {
    if (form.skater_ids.length === 0) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>{title}</div>

      <div className="form-group" style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 13 }}>Event Label <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span></label>
        <input value={form.label} onChange={(e) => set('label', e.target.value)} placeholder="e.g. Skating lesson" style={{ fontSize: 13 }} />
      </div>

      <div className="form-group" style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 13 }}>Skaters</label>
        <SkaterPicker students={students} value={form.skater_ids} onChange={(ids) => set('skater_ids', ids)} />
      </div>

      {form.mode === 'once' ? (
        <div className="form-group" style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 13 }}>Date</label>
          <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
        </div>
      ) : (
        <>
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 13 }}>Day of Week</label>
            <select value={form.day_of_week} onChange={(e) => set('day_of_week', Number(e.target.value))}>
              {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label style={{ fontSize: 13 }}>Start date</label>
              <input type="date" value={form.effective_from} onChange={(e) => set('effective_from', e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label style={{ fontSize: 13 }}>End date <span style={{ fontWeight: 400, color: '#9ca3af' }}>(opt.)</span></label>
              <input type="date" value={form.effective_until || ''} onChange={(e) => set('effective_until', e.target.value)} />
            </div>
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
          <label style={{ fontSize: 13 }}>Start time <span style={{ fontWeight: 400, color: '#9ca3af' }}>(opt.)</span></label>
          <input type="time" value={form.start_time || ''} onChange={(e) => set('start_time', e.target.value)} />
        </div>
        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
          <label style={{ fontSize: 13 }}>Duration (min)</label>
          <input type="number" min="15" step="15" value={form.duration_mins || ''} onChange={(e) => set('duration_mins', Number(e.target.value))} />
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 13 }}>Charge Type</label>
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
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 13 }}>Lesson Type</label>
            <select value={form.lesson_type} onChange={(e) => set('lesson_type', e.target.value)}>
              <option value="private">Private</option>
              <option value="semi_private">Semi-Private</option>
              <option value="group">Group</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 13 }}>Rate ($/hr)</label>
            <input type="number" min="0" step="0.01" value={form.rate_per_hour || ''} onChange={(e) => set('rate_per_hour', e.target.value)} placeholder="0.00" />
          </div>
          {form.skater_ids.length > 1 && form.rate_per_hour && (
            <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 10 }}>
              ${Number(form.rate_per_hour).toFixed(2)}/hr ÷ {form.skater_ids.length} skaters = ${(Number(form.rate_per_hour) / form.skater_ids.length).toFixed(2)}/hr each
            </div>
          )}
        </>
      ) : (
        <>
          {form.billing_type === 'custom' && (
            <div className="form-group" style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 13 }}>Label</label>
              <input value={form.custom_label || ''} onChange={(e) => set('custom_label', e.target.value)} placeholder="e.g. Costume fee" />
            </div>
          )}
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 13 }}>Amount per skater ($)</label>
            <input type="number" min="0" step="0.01" value={form.flat_amount || ''} onChange={(e) => set('flat_amount', e.target.value)} placeholder="0.00" />
          </div>
        </>
      )}

      <div className="form-group" style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 13 }}>Notes <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional — appears on invoice)</span></label>
        <textarea rows={2} value={form.notes || ''} onChange={(e) => set('notes', e.target.value)}
          style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving || form.skater_ids.length === 0}>
          {saving ? 'Saving…' : saveLabel}
        </button>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function occurrenceToForm(occ) {
  return {
    label: occ.label || '',
    notes: occ.notes || '',
    skater_ids: occ.skater_ids || [],
    mode: occ.recurring ? 'recurring' : 'once',
    date: occ.occurrence_date,
    day_of_week: occ.day_of_week ?? new Date(occ.occurrence_date + 'T12:00:00').getDay(),
    effective_from: occ.effective_from || occ.occurrence_date,
    effective_until: occ.effective_until || '',
    start_time: occ.start_time || '',
    duration_mins: occ.duration_mins || 60,
    billing_type: occ.billing_type || 'hourly',
    lesson_type: occ.lesson_type || 'private',
    rate_per_hour: occ.rate_per_hour || '',
    flat_amount: occ.flat_amount || '',
    custom_label: occ.custom_label || '',
  };
}

async function fetchMonths(months) {
  const results = await Promise.all(
    months.map((m) => fetch(`/api/events/calendar?month=${m}`).then((r) => r.json()))
  );
  const seen = new Set();
  const merged = [];
  for (const arr of results) {
    if (!Array.isArray(arr)) continue;
    for (const occ of arr) {
      const key = `${occ.event_id}-${occ.occurrence_date}`;
      if (!seen.has(key)) { seen.add(key); merged.push(occ); }
    }
  }
  return merged;
}

export default function Calendar() {
  const [occurrences, setOccurrences] = useState([]);
  const [students, setStudents] = useState([]);
  const [editingOcc, setEditingOcc] = useState(null);
  const [scopePrompt, setScopePrompt] = useState(null);
  const [deletingOcc, setDeletingOcc] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFrom, setExportFrom] = useState(new Date().toISOString().slice(0, 7));
  const [exportTo, setExportTo] = useState(new Date().toISOString().slice(0, 7));
  const [legendOpen, setLegendOpen] = useState(false);
  const visibleMonthsRef = useRef([new Date().toISOString().slice(0, 7)]);
  const calendarRef = useRef(null);

  useEffect(() => {
    fetch('/api/students').then((r) => r.json()).then((data) => setStudents(Array.isArray(data) ? data : []));
  }, []);

  const reloadOccurrences = useCallback(() => {
    fetchMonths(visibleMonthsRef.current).then(setOccurrences);
  }, []);

  useEffect(() => { reloadOccurrences(); }, []);

  const handleDatesSet = useCallback(({ start, end }) => {
    const months = new Set();
    const cursor = new Date(start);
    while (cursor < end) {
      months.add(cursor.toISOString().slice(0, 7));
      cursor.setMonth(cursor.getMonth() + 1);
      cursor.setDate(1);
    }
    const newMonths = [...months].sort();
    if ([...visibleMonthsRef.current].sort().join(',') !== newMonths.join(',')) {
      visibleMonthsRef.current = newMonths;
      fetchMonths(newMonths).then(setOccurrences);
    }
  }, []);

  const fcEvents = occurrences.map((occ) => {
    const hasTime = !!occ.start_time;
    return {
      id: `${occ.event_id}-${occ.occurrence_date}`,
      title: occurrenceLabel(occ),
      start: hasTime ? `${occ.occurrence_date}T${occ.start_time}:00` : occ.occurrence_date,
      end: hasTime ? computeEnd(occ.occurrence_date, occ.start_time, occ.duration_mins) : undefined,
      allDay: !hasTime,
      backgroundColor: occurrenceColor(occ),
      borderColor: occurrenceColor(occ),
      textColor: '#fff',
      extendedProps: { occurrence: occ },
    };
  });

  const handleEventClick = ({ event }) => {
    const occ = event.extendedProps.occurrence;
    setEditingOcc(occ);
    setScopePrompt(null);
    setDeletingOcc(null);
    setTimeout(() => document.getElementById('cal-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const scrollToPanel = () =>
    setTimeout(() => document.getElementById('cal-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);

  const handleEditSave = (occ, form) => {
    if (occ.recurring) {
      setScopePrompt({ occ, form });
      setEditingOcc(null);
      scrollToPanel();
    } else {
      applyEditAllFuture(occ, form).then(() => { setEditingOcc(null); reloadOccurrences(); });
    }
  };

  const applyEditThisOnly = async (occ, form) => {
    await fetch(`/api/events/${occ.event_id}/exceptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        occurrence_date: occ.occurrence_date,
        is_cancelled: false,
        override_start_time: form.start_time || null,
        override_duration_mins: form.duration_mins ? Number(form.duration_mins) : null,
        override_rate_per_hour: form.billing_type === 'hourly' ? Number(form.rate_per_hour || 0) : null,
        override_lesson_type: form.lesson_type || null,
        override_skater_ids: form.skater_ids,
        notes: form.notes || null,
      }),
    });
  };

  const applyEditAllFuture = async (occ, form) => {
    if (occ.recurring) {
      await fetch(`/api/events/${occ.event_id}/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          occurrence_date: occ.occurrence_date,
          label: form.label || null, notes: form.notes || null,
          skater_ids: form.skater_ids, recurring: true,
          day_of_week: form.day_of_week, effective_from: occ.occurrence_date, effective_until: null,
          start_time: form.start_time || null,
          duration_mins: form.duration_mins ? Number(form.duration_mins) : null,
          billing_type: form.billing_type, lesson_type: form.lesson_type,
          rate_per_hour: form.billing_type === 'hourly' ? Number(form.rate_per_hour || 0) : null,
          flat_amount: form.billing_type !== 'hourly' ? Number(form.flat_amount || 0) : null,
          custom_label: form.billing_type === 'custom' ? form.custom_label : null,
        }),
      });
    } else {
      await fetch(`/api/events/${occ.event_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: form.label || null, notes: form.notes || null,
          skater_ids: form.skater_ids, recurring: false,
          date: form.date, effective_from: form.date, effective_until: null,
          start_time: form.start_time || null,
          duration_mins: form.duration_mins ? Number(form.duration_mins) : null,
          billing_type: form.billing_type, lesson_type: form.lesson_type,
          rate_per_hour: form.billing_type === 'hourly' ? Number(form.rate_per_hour || 0) : null,
          flat_amount: form.billing_type !== 'hourly' ? Number(form.flat_amount || 0) : null,
          custom_label: form.billing_type === 'custom' ? form.custom_label : null,
        }),
      });
    }
  };

  const handleDeleteThisOnly = async (occ) => {
    await fetch(`/api/events/${occ.event_id}/exceptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ occurrence_date: occ.occurrence_date, is_cancelled: true }),
    });
    setDeletingOcc(null);
    reloadOccurrences();
  };

  const handleDeleteAll = async (occ) => {
    await fetch(`/api/events/${occ.event_id}`, { method: 'DELETE' });
    setDeletingOcc(null);
    reloadOccurrences();
  };

  const closePanel = () => { setEditingOcc(null); setScopePrompt(null); setDeletingOcc(null); };

  const LEGEND = [
    { color: COLORS.private,         label: 'Private' },
    { color: COLORS.semi_private,    label: 'Semi-Private' },
    { color: COLORS.group,           label: 'Group' },
    { color: COLORS.choreography,    label: 'Choreography' },
    { color: COLORS.competition_fee, label: 'Competition' },
    { color: COLORS.flat_fee,        label: 'Flat Fee / Custom' },
  ];

  return (
    <div className="page">
      {/* Top panel — export / edit / scope / delete */}
      <div id="cal-panel">
        {exportOpen && (
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Export Schedule</span>
              <button onClick={() => setExportOpen(false)} style={{ background: 'none', border: 'none', fontSize: 18, color: '#9ca3af', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4 }}>From</div>
                <input type="month" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)}
                  style={{ width: '100%', padding: '9px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4 }}>To</div>
                <input type="month" value={exportTo} onChange={(e) => setExportTo(e.target.value)}
                  style={{ width: '100%', padding: '9px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <a href={`/api/events/export.pdf?from=${exportFrom}&to=${exportTo}`} target="_blank" rel="noreferrer"
                style={{ display: 'block', padding: '11px 16px', background: '#2563eb', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 600, textAlign: 'center', textDecoration: 'none' }}>
                Download PDF Schedule
              </a>
              <a href={`/api/events/export.ics?from=${exportFrom}&to=${exportTo}`}
                style={{ display: 'block', padding: '11px 16px', background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, fontWeight: 600, textAlign: 'center', textDecoration: 'none' }}>
                Download .ics (Google / Apple Calendar)
              </a>
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 10 }}>
              PDF is a printable list. .ics imports into Google Calendar, Apple Calendar, or Outlook.
            </div>
          </div>
        )}

        {editingOcc && (
          <>
            <EventForm
              students={students}
              initial={occurrenceToForm(editingOcc)}
              title={`Edit: ${occurrenceLabel(editingOcc)}`}
              saveLabel="Save Changes"
              onSave={(form) => handleEditSave(editingOcc, form)}
              onCancel={closePanel}
            />
            <button
              onClick={() => { setDeletingOcc({ occ: editingOcc }); setEditingOcc(null); scrollToPanel(); }}
              style={{ display: 'block', width: '100%', padding: '12px', marginBottom: 16, background: '#fff', border: '1px solid #fca5a5', borderRadius: 10, color: '#dc2626', fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'center' }}>
              Delete this event…
            </button>
          </>
        )}

        {scopePrompt && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Save changes for…</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>This is a recurring event. Which occurrences should be updated?</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button style={{ padding: '11px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'center' }} onClick={async () => {
                await applyEditThisOnly(scopePrompt.occ, scopePrompt.form);
                setScopePrompt(null); reloadOccurrences();
              }}>This occurrence only</button>
              <button style={{ padding: '11px 16px', background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'center' }} onClick={async () => {
                await applyEditAllFuture(scopePrompt.occ, scopePrompt.form);
                setScopePrompt(null); reloadOccurrences();
              }}>This and all future</button>
              <button style={{ padding: '11px 16px', background: '#fff', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', textAlign: 'center' }} onClick={() => setScopePrompt(null)}>Cancel</button>
            </div>
          </div>
        )}

        {deletingOcc && (
          <div style={{ background: '#fff', border: '1px solid #fca5a5', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Delete event?</div>
            {deletingOcc.occ.recurring && (
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>This is a recurring event. Which occurrences should be deleted?</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: deletingOcc.occ.recurring ? 0 : 12 }}>
              {deletingOcc.occ.recurring && (
                <button style={{ padding: '11px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'center' }} onClick={() => handleDeleteThisOnly(deletingOcc.occ)}>
                  This occurrence only
                </button>
              )}
              <button style={{ padding: '11px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'center' }} onClick={() => handleDeleteAll(deletingOcc.occ)}>
                {deletingOcc.occ.recurring ? 'All events' : 'Delete event'}
              </button>
              <button style={{ padding: '11px 16px', background: '#fff', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', textAlign: 'center' }} onClick={() => setDeletingOcc(null)}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* FullCalendar */}
      <FullCalendar
        ref={calendarRef}
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        customButtons={{
          exportBtn: {
            text: 'Export',
            click: () => {
              setExportOpen((v) => !v);
              setTimeout(() => document.getElementById('cal-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
            },
          },
        }}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'exportBtn timeGridWeek,timeGridDay',
        }}
        buttonText={{ week: 'Week', day: 'Day' }}
        height="auto"
        events={fcEvents}
        eventClick={handleEventClick}
        datesSet={handleDatesSet}
        nowIndicator={true}
        slotMinTime="06:00:00"
        slotMaxTime="22:00:00"
      />

      <div style={{ marginTop: 12, borderTop: '1px solid #f3f4f6', paddingTop: 10 }}>
        <button onClick={() => setLegendOpen((v) => !v)}
          style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 500, color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
          Colour Legend <span style={{ fontSize: 10 }}>{legendOpen ? '▲' : '▾'}</span>
        </button>
        {legendOpen && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginTop: 8 }}>
            {LEGEND.map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#374151' }}>{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .fc { font-family: inherit; font-size: 14px; }
        /* Grid borders — visible but subtle */
        .fc-theme-standard td, .fc-theme-standard th { border-color: #e5e7eb; }
        .fc-theme-standard .fc-scrollgrid { border-color: #e5e7eb; }
        /* Toolbar */
        .fc .fc-toolbar-title { font-size: 15px; font-weight: 700; color: #111827; }
        /* Buttons */
        .fc .fc-button-primary {
          background: #f3f4f6 !important; border: 1px solid #d1d5db !important;
          color: #374151 !important; font-size: 12px; padding: 5px 10px !important;
          border-radius: 6px !important; font-weight: 500; box-shadow: none !important;
          text-transform: capitalize;
        }
        .fc .fc-button-primary:hover:not(:disabled) {
          background: #e5e7eb !important; border-color: #9ca3af !important; color: #111827 !important;
        }
        .fc .fc-button-primary:focus { box-shadow: none !important; }
        .fc .fc-button-primary:not(:disabled).fc-button-active,
        .fc .fc-button-primary:not(:disabled):active {
          background: #2563eb !important; border-color: #2563eb !important; color: #fff !important;
        }
        .fc .fc-button-group .fc-button-primary { border-radius: 0 !important; }
        .fc .fc-button-group .fc-button-primary:first-child { border-radius: 6px 0 0 6px !important; }
        .fc .fc-button-group .fc-button-primary:last-child { border-radius: 0 6px 6px 0 !important; }
        /* Day numbers & headers */
        .fc .fc-exportBtn-button { background: #eff6ff !important; border-color: #bfdbfe !important; color: #2563eb !important; }
        .fc .fc-exportBtn-button:hover { background: #dbeafe !important; }
        .fc .fc-col-header-cell-cushion {
          font-size: 11px; font-weight: 600; color: #6b7280;
          text-transform: uppercase; text-decoration: none; padding: 6px 4px;
        }
        /* Events */
        .fc .fc-event { border-radius: 4px; font-size: 11px; cursor: pointer; border: none !important; }
        /* Time grid */
        .fc .fc-timegrid-slot { height: 2.5em; }
        .fc .fc-timegrid-slot-label { font-size: 11px; color: #9ca3af; }
        .fc .fc-timegrid-now-indicator-line { border-color: #ef4444; }
        .fc .fc-timegrid-now-indicator-arrow { border-top-color: #ef4444; border-bottom-color: #ef4444; }
        /* Mobile */
        @media (max-width: 480px) {
          .fc .fc-toolbar { flex-direction: column; gap: 8px; align-items: center; }
          .fc .fc-toolbar-title { font-size: 14px; }
          .fc .fc-button-primary { font-size: 11px !important; padding: 4px 8px !important; }
        }
      `}</style>
    </div>
  );
}
