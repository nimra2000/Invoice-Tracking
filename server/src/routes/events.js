const express = require('express');
const db = require('../db');

const router = express.Router();

// Generate occurrence dates for a recurring event within a year-month
function getOccurrencesInMonth(event, yearMonth) {
  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const dates = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    if (date.getDay() === event.day_of_week) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (dateStr >= event.effective_from && (!event.effective_until || dateStr <= event.effective_until)) {
        dates.push(dateStr);
      }
    }
  }
  return dates;
}

// Build an occurrence object from an event + optional exception override
function buildOccurrence(event, date, exc, students) {
  const skaterIds = exc?.override_skater_ids ?? event.skater_ids ?? [];
  const skaterNames = skaterIds.map((id) => {
    const s = students.find((s) => s.id === id);
    return s ? s.name : 'Unknown';
  });
  return {
    event_id: event.id,
    occurrence_date: date,
    label: event.label || null,
    notes: exc?.notes ?? event.notes ?? null,
    skater_ids: skaterIds,
    skater_names: skaterNames,
    start_time: exc?.override_start_time ?? event.start_time ?? null,
    duration_mins: exc?.override_duration_mins ?? event.duration_mins ?? null,
    billing_type: event.billing_type,
    lesson_type: exc?.override_lesson_type ?? event.lesson_type ?? 'private',
    rate_per_hour: exc?.override_rate_per_hour ?? event.rate_per_hour ?? null,
    flat_amount: event.flat_amount ?? null,
    custom_label: event.custom_label ?? null,
    recurring: event.recurring,
    day_of_week: event.day_of_week ?? null,
    effective_from: event.effective_from ?? null,
    effective_until: event.effective_until ?? null,
    is_exception: !!exc,
  };
}

// GET /api/events/calendar?month=YYYY-MM
router.get('/calendar', async (req, res) => {
  try {
    const { month } = req.query;
    const owner = req.session.user.email;
    const [events, students, exceptions] = await Promise.all([
      db.getEvents(owner),
      db.getStudents(owner),
      db.getEventExceptions(owner),
    ]);

    const occurrences = [];
    for (const event of events) {
      if (event.recurring) {
        for (const date of getOccurrencesInMonth(event, month)) {
          const exc = exceptions.find((e) => e.event_id === event.id && e.occurrence_date === date);
          if (exc?.is_cancelled) continue;
          occurrences.push(buildOccurrence(event, date, exc, students));
        }
      } else if (event.date && event.date.slice(0, 7) === month) {
        const exc = exceptions.find((e) => e.event_id === event.id && e.occurrence_date === event.date);
        if (!exc?.is_cancelled) {
          occurrences.push(buildOccurrence(event, event.date, exc, students));
        }
      }
    }
    res.json(occurrences.sort((a, b) =>
      a.occurrence_date.localeCompare(b.occurrence_date) ||
      (a.start_time || '').localeCompare(b.start_time || '')
    ));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/events/charges?student_id=&month= (for invoice)
router.get('/charges', async (req, res) => {
  try {
    const { student_id, month } = req.query;
    const owner = req.session.user.email;
    const [events, students, exceptions] = await Promise.all([
      db.getEvents(owner),
      db.getStudents(owner),
      db.getEventExceptions(owner),
    ]);

    const charges = [];
    for (const event of events) {
      const processOccurrence = (date, exc) => {
        const skaterIds = exc?.override_skater_ids ?? event.skater_ids ?? [];
        if (!skaterIds.includes(Number(student_id))) return;
        if (exc?.is_cancelled) return;
        charges.push(buildOccurrence(event, date, exc, students));
      };

      if (event.recurring) {
        for (const date of getOccurrencesInMonth(event, month)) {
          const exc = exceptions.find((e) => e.event_id === event.id && e.occurrence_date === date);
          processOccurrence(date, exc);
        }
      } else if (event.date && event.date.slice(0, 7) === month) {
        const exc = exceptions.find((e) => e.event_id === event.id && e.occurrence_date === event.date);
        processOccurrence(event.date, exc);
      }
    }
    res.json(charges.sort((a, b) => a.occurrence_date.localeCompare(b.occurrence_date)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Collect all occurrences across a range of months
async function getOccurrencesForRange(owner, fromMonth, toMonth) {
  const [events, students, exceptions] = await Promise.all([
    db.getEvents(owner),
    db.getStudents(owner),
    db.getEventExceptions(owner),
  ]);
  const months = [];
  const [fy, fm] = fromMonth.split('-').map(Number);
  const [ty, tm] = toMonth.split('-').map(Number);
  let y = fy, m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  const seen = new Set();
  const occurrences = [];
  for (const month of months) {
    for (const event of events) {
      if (event.recurring) {
        for (const date of getOccurrencesInMonth(event, month)) {
          const key = `${event.id}-${date}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const exc = exceptions.find((e) => e.event_id === event.id && e.occurrence_date === date);
          if (exc?.is_cancelled) continue;
          occurrences.push(buildOccurrence(event, date, exc, students));
        }
      } else if (event.date && event.date.slice(0, 7) === month) {
        const key = `${event.id}-${event.date}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const exc = exceptions.find((e) => e.event_id === event.id && e.occurrence_date === event.date);
        if (!exc?.is_cancelled) occurrences.push(buildOccurrence(event, event.date, exc, students));
      }
    }
  }
  return occurrences.sort((a, b) => a.occurrence_date.localeCompare(b.occurrence_date));
}

// GET /api/events/export.ics?from=YYYY-MM&to=YYYY-MM
router.get('/export.ics', async (req, res) => {
  try {
    const now = new Date().toISOString().slice(0, 7);
    const from = req.query.from || now;
    const to = req.query.to || now;
    const occurrences = await getOccurrencesForRange(req.session.user.email, from, to);

    const lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0',
      'PRODID:-//Lesson Tracker//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    ];
    for (const occ of occurrences) {
      const summary = [occ.label, occ.skater_names?.join(', ')].filter(Boolean).join(' – ') || 'Lesson';
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:event-${occ.event_id}-${occ.occurrence_date}@coachapp`);
      const dateStr = occ.occurrence_date.replace(/-/g, '');
      if (occ.start_time) {
        const timeStr = occ.start_time.replace(':', '') + '00';
        lines.push(`DTSTART:${dateStr}T${timeStr}`);
        if (occ.duration_mins) {
          const [h, m] = occ.start_time.split(':').map(Number);
          const totalMins = h * 60 + m + Number(occ.duration_mins);
          const endH = String(Math.floor(totalMins / 60) % 24).padStart(2, '0');
          const endM = String(totalMins % 60).padStart(2, '0');
          lines.push(`DTEND:${dateStr}T${endH}${endM}00`);
        } else {
          lines.push(`DTEND:${dateStr}T${timeStr}`);
        }
      } else {
        lines.push(`DTSTART;VALUE=DATE:${dateStr}`);
        const next = new Date(occ.occurrence_date + 'T12:00:00');
        next.setDate(next.getDate() + 1);
        lines.push(`DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replace(/-/g, '')}`);
      }
      lines.push(`SUMMARY:${summary}`);
      if (occ.notes) lines.push(`DESCRIPTION:${occ.notes.replace(/[\r\n]+/g, '\\n')}`);
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="lessons-${from}-to-${to}.ics"`);
    res.send(lines.join('\r\n'));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/events/export.pdf?from=YYYY-MM&to=YYYY-MM
router.get('/export.pdf', async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');
    const now = new Date().toISOString().slice(0, 7);
    const from = req.query.from || now;
    const to = req.query.to || now;
    const occurrences = await getOccurrencesForRange(req.session.user.email, from, to);

    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    const buffers = [];
    doc.on('data', (c) => buffers.push(c));
    doc.on('end', () => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="schedule-${from}-to-${to}.pdf"`);
      res.send(Buffer.concat(buffers));
    });

    const LESSON_LABELS = { private: 'Private', semi_private: 'Semi-Private', group: 'Group' };
    const BILLING_LABELS = { hourly: 'Hourly', flat_fee: 'Flat Fee', choreography: 'Choreography', competition_fee: 'Competition Fee', custom: 'Custom' };

    function fmtTime(t) {
      if (!t) return '';
      const [h, m] = t.split(':').map(Number);
      return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
    }
    function fmtDur(mins) {
      if (!mins) return '';
      const d = Number(mins);
      return d < 60 ? `${d} min` : `${Math.floor(d / 60)}h${d % 60 ? ` ${d % 60}min` : ''}`;
    }

    // Title
    const [fy, fm] = from.split('-');
    const [ty, tm] = to.split('-');
    const fromLabel = new Date(Number(fy), Number(fm) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
    const toLabel   = new Date(Number(ty), Number(tm) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
    const rangeLabel = from === to ? fromLabel : `${fromLabel} – ${toLabel}`;

    doc.fontSize(18).font('Helvetica-Bold').fillColor('#000').text('Lesson Schedule', 50, 50);
    doc.fontSize(11).font('Helvetica').fillColor('#555').text(rangeLabel, 50, doc.y + 2);
    doc.moveTo(50, doc.y + 8).lineTo(560, doc.y + 8).strokeColor('#cccccc').lineWidth(1).stroke();

    // Group by month
    const byMonth = {};
    for (const occ of occurrences) {
      const mk = occ.occurrence_date.slice(0, 7);
      if (!byMonth[mk]) byMonth[mk] = [];
      byMonth[mk].push(occ);
    }

    let curY = doc.y + 20;

    if (occurrences.length === 0) {
      doc.fontSize(11).fillColor('#999').text('No events in this range.', 50, curY);
    }

    for (const [month, occs] of Object.entries(byMonth)) {
      const [my, mm] = month.split('-');
      const monthLabel = new Date(Number(my), Number(mm) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });

      if (curY > 680) { doc.addPage(); curY = 50; }

      // Month header
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#1a1a1a').text(monthLabel, 50, curY);
      curY += 16;
      doc.moveTo(50, curY).lineTo(560, curY).strokeColor('#e0e0e0').lineWidth(0.5).stroke();
      curY += 8;

      for (const occ of occs) {
        // Build strings
        const dateObj = new Date(occ.occurrence_date + 'T12:00:00');
        const dateStr = dateObj.toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric' });

        const studentNames = (occ.skater_names || []).join(', ') || '—';
        const titleStr = occ.label || dateStr;

        const timeStr = fmtTime(occ.start_time);
        const durStr  = fmtDur(occ.duration_mins);
        const timeDur = [timeStr, durStr].filter(Boolean).join(' · ');

        let typeStr = '';
        if (!occ.billing_type || occ.billing_type === 'hourly') {
          const lt   = LESSON_LABELS[occ.lesson_type] || 'Private';
          const rate = occ.rate_per_hour ? `$${Number(occ.rate_per_hour).toFixed(0)}/hr` : '';
          typeStr = [lt, rate].filter(Boolean).join('  ·  ');
        } else {
          const bt  = BILLING_LABELS[occ.billing_type] || occ.billing_type;
          const cl  = occ.custom_label ? `(${occ.custom_label})` : '';
          const amt = occ.flat_amount ? `$${Number(occ.flat_amount).toFixed(2)}` : '';
          typeStr = [bt, cl, amt].filter(Boolean).join('  ·  ');
        }

        // Estimate row height
        const noteLines = occ.notes ? Math.ceil(occ.notes.length / 65) : 0;
        const rowH = 14 + 13 + 13 + noteLines * 12 + 8;
        if (curY + rowH > 720) { doc.addPage(); curY = 50; }

        // Row 1 — Date (bold) + time/dur (right)
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#000')
          .text(dateStr, 50, curY, { width: 300, lineBreak: false });
        if (timeDur) {
          doc.fontSize(10).font('Helvetica').fillColor('#444')
            .text(timeDur, 350, curY, { width: 210, align: 'right', lineBreak: false });
        }
        curY += 14;

        // Row 2 — Students label + names
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#555')
          .text('Students:', 50, curY, { width: 65, lineBreak: false });
        doc.fontSize(9).font('Helvetica').fillColor('#111')
          .text(studentNames, 118, curY, { width: 440, lineBreak: false });
        curY += 13;

        // Row 3 — Lesson/billing type
        if (typeStr) {
          doc.fontSize(9).font('Helvetica').fillColor('#777')
            .text(typeStr, 50, curY, { width: 510, lineBreak: false });
          curY += 13;
        }

        // Row 4 — Notes (if any)
        if (occ.notes) {
          doc.fontSize(9).font('Helvetica-Oblique').fillColor('#888')
            .text(`Notes: ${occ.notes}`, 50, curY, { width: 510, lineBreak: true });
          curY = doc.y + 2;
          doc.font('Helvetica');
        }

        doc.fillColor('#000');

        // Light row separator
        doc.moveTo(50, curY + 2).lineTo(560, curY + 2).strokeColor('#f0f0f0').lineWidth(0.5).stroke();
        curY += 8;
      }

      curY += 8; // gap between months
    }

    doc.end();
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/events
router.get('/', async (req, res) => {
  try {
    res.json(await db.getEvents(req.session.user.email));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/events
router.post('/', async (req, res) => {
  try {
    const {
      label, notes, skater_ids,
      recurring, day_of_week, date, effective_from, effective_until,
      start_time, duration_mins,
      billing_type, lesson_type, rate_per_hour, flat_amount, custom_label,
    } = req.body;
    res.json(await db.addEvent(req.session.user.email, {
      label: label || null,
      notes: notes || null,
      skater_ids: Array.isArray(skater_ids) ? skater_ids.map(Number) : [],
      recurring: Boolean(recurring),
      day_of_week: recurring ? Number(day_of_week) : null,
      date: recurring ? null : (date || null),
      effective_from: recurring ? effective_from : (date || null),
      effective_until: recurring ? (effective_until || null) : null,
      start_time: start_time || null,
      duration_mins: duration_mins ? Number(duration_mins) : null,
      billing_type: billing_type || 'hourly',
      lesson_type: lesson_type || 'private',
      rate_per_hour: rate_per_hour != null ? Number(rate_per_hour) : null,
      flat_amount: flat_amount != null ? Number(flat_amount) : null,
      custom_label: custom_label || null,
    }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/events/:id (update the base event — "all future")
router.put('/:id', async (req, res) => {
  try {
    const {
      label, notes, skater_ids,
      recurring, day_of_week, date, effective_from, effective_until,
      start_time, duration_mins,
      billing_type, lesson_type, rate_per_hour, flat_amount, custom_label,
    } = req.body;
    const updated = await db.updateEvent(req.params.id, req.session.user.email, {
      label: label || null,
      notes: notes || null,
      skater_ids: Array.isArray(skater_ids) ? skater_ids.map(Number) : [],
      recurring: Boolean(recurring),
      day_of_week: recurring ? Number(day_of_week) : null,
      date: recurring ? null : (date || null),
      effective_from: recurring ? effective_from : (date || null),
      effective_until: recurring ? (effective_until || null) : null,
      start_time: start_time || null,
      duration_mins: duration_mins ? Number(duration_mins) : null,
      billing_type: billing_type || 'hourly',
      lesson_type: lesson_type || 'private',
      rate_per_hour: rate_per_hour != null ? Number(rate_per_hour) : null,
      flat_amount: flat_amount != null ? Number(flat_amount) : null,
      custom_label: custom_label || null,
    });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/events/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.deleteEvent(req.params.id, req.session.user.email);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/events/:id/exceptions — modify or cancel a single occurrence
router.post('/:id/exceptions', async (req, res) => {
  try {
    const {
      occurrence_date, is_cancelled,
      override_start_time, override_duration_mins,
      override_rate_per_hour, override_lesson_type,
      override_skater_ids, notes,
    } = req.body;
    await db.upsertEventException(req.session.user.email, {
      event_id: Number(req.params.id),
      occurrence_date,
      is_cancelled: Boolean(is_cancelled),
      override_start_time: override_start_time || null,
      override_duration_mins: override_duration_mins != null ? Number(override_duration_mins) : null,
      override_rate_per_hour: override_rate_per_hour != null ? Number(override_rate_per_hour) : null,
      override_lesson_type: override_lesson_type || null,
      override_skater_ids: Array.isArray(override_skater_ids) ? override_skater_ids.map(Number) : null,
      notes: notes || null,
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/events/:id/split — "this and all future": ends current at prev day, creates new from occurrence_date
router.post('/:id/split', async (req, res) => {
  try {
    const owner = req.session.user.email;
    const events = await db.getEvents(owner);
    const current = events.find((e) => e.id === Number(req.params.id));
    if (!current) return res.status(404).json({ error: 'Not found' });

    const { occurrence_date, ...updates } = req.body;

    // End the current event the day before the split date
    const prev = new Date(occurrence_date);
    prev.setDate(prev.getDate() - 1);
    await db.updateEvent(req.params.id, owner, { ...current, effective_until: prev.toISOString().slice(0, 10) });

    // Create new event from occurrence_date onwards
    const newEvent = await db.addEvent(owner, {
      ...current,
      ...updates,
      effective_from: occurrence_date,
      effective_until: null,
      id: undefined,
      owner_email: undefined,
      skater_ids: Array.isArray(updates.skater_ids) ? updates.skater_ids.map(Number) : current.skater_ids,
    });
    res.json(newEvent);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
