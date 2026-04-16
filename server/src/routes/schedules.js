const express = require('express');
const db = require('../db');

const router = express.Router();

function getOccurrencesInMonth(schedule, yearMonth) {
  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const dates = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    if (date.getDay() === schedule.day_of_week) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (dateStr >= schedule.effective_from && (!schedule.effective_until || dateStr <= schedule.effective_until)) {
        dates.push(dateStr);
      }
    }
  }
  return dates;
}

// Get schedules for a student
router.get('/', async (req, res) => {
  try {
    res.json(await db.getSchedules(req.session.user.email, req.query.student_id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get generated occurrences for a student + month (for invoice page)
router.get('/occurrences', async (req, res) => {
  try {
    const { student_id, month } = req.query;
    const [schedules, exceptions] = await Promise.all([
      db.getSchedules(req.session.user.email, student_id),
      db.getExceptions(req.session.user.email),
    ]);
    const occurrences = [];
    for (const schedule of schedules) {
      for (const date of getOccurrencesInMonth(schedule, month)) {
        const exc = exceptions.find((e) => e.schedule_id === schedule.id && e.occurrence_date === date);
        if (exc?.is_cancelled) continue;
        occurrences.push({
          schedule_id: schedule.id,
          date,
          start_time: exc?.override_start_time || schedule.start_time,
          duration_mins: exc?.override_duration_mins ?? schedule.duration_mins,
          rate_per_hour: exc?.override_rate_per_hour ?? schedule.rate_per_hour,
          type: exc?.override_type || schedule.type,
          num_students: schedule.num_students || 1,
          billing_type: 'hourly',
          notes: exc?.notes ?? schedule.notes ?? null,
          is_exception: !!exc,
        });
      }
    }
    res.json(occurrences.sort((a, b) => a.date.localeCompare(b.date)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get all occurrences for all students in a month (for calendar)
router.get('/calendar', async (req, res) => {
  try {
    const { month } = req.query;
    const owner = req.session.user.email;
    const [schedules, students, exceptions, allLessons] = await Promise.all([
      db.getSchedules(owner),
      db.getStudents(owner),
      db.getExceptions(owner),
      db.getLessons(owner, { month }),
    ]);
    const events = [];
    for (const schedule of schedules) {
      const student = students.find((s) => s.id === schedule.student_id);
      if (!student) continue;
      for (const date of getOccurrencesInMonth(schedule, month)) {
        const exc = exceptions.find((e) => e.schedule_id === schedule.id && e.occurrence_date === date);
        if (exc?.is_cancelled) continue;
        events.push({
          schedule_id: schedule.id,
          student_id: schedule.student_id,
          student_name: student.name,
          date,
          start_time: exc?.override_start_time || schedule.start_time,
          duration_mins: exc?.override_duration_mins ?? schedule.duration_mins,
          type: exc?.override_type || schedule.type,
          num_students: schedule.num_students || 1,
          notes: exc?.notes ?? schedule.notes ?? null,
          is_exception: !!exc,
          source: 'schedule',
        });
      }
    }
    for (const lesson of allLessons) {
      const student = students.find((s) => s.id === lesson.student_id);
      events.push({
        lesson_id: lesson.id,
        student_id: lesson.student_id,
        student_name: student ? student.name : 'Unknown',
        date: lesson.date,
        start_time: lesson.start_time || null,
        duration_mins: lesson.duration_mins || null,
        type: lesson.billing_type && lesson.billing_type !== 'hourly' ? lesson.billing_type : (lesson.type || 'private'),
        num_students: lesson.num_students || 1,
        notes: lesson.notes || null,
        source: 'lesson',
      });
    }
    res.json(events.sort((a, b) => a.date.localeCompare(b.date) || (a.start_time || '').localeCompare(b.start_time || '')));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Create schedule
router.post('/', async (req, res) => {
  try {
    const { student_id, day_of_week, start_time, duration_mins, rate_per_hour, type, num_students, effective_from, effective_until, notes } = req.body;
    res.json(await db.addSchedule(req.session.user.email, {
      student_id: Number(student_id),
      day_of_week: Number(day_of_week),
      start_time,
      duration_mins: Number(duration_mins),
      rate_per_hour: Number(rate_per_hour),
      type,
      num_students: Number(num_students || 1),
      effective_from,
      effective_until: effective_until || null,
      notes: notes || null,
    }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Update schedule
router.put('/:id', async (req, res) => {
  try {
    const { day_of_week, start_time, duration_mins, rate_per_hour, type, num_students, effective_from, effective_until, notes } = req.body;
    const updated = await db.updateSchedule(req.params.id, req.session.user.email, {
      day_of_week: Number(day_of_week), start_time,
      duration_mins: Number(duration_mins), rate_per_hour: Number(rate_per_hour),
      type, num_students: Number(num_students || 1),
      effective_from, effective_until: effective_until || null,
      notes: notes || null,
    });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete schedule
router.delete('/:id', async (req, res) => {
  try {
    await db.deleteSchedule(req.params.id, req.session.user.email);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Cancel or modify a single occurrence (this event only)
router.post('/:id/exceptions', async (req, res) => {
  try {
    const { occurrence_date, is_cancelled, override_duration_mins, override_rate_per_hour, override_type, override_start_time } = req.body;
    await db.upsertException(req.session.user.email, {
      schedule_id: Number(req.params.id),
      occurrence_date,
      is_cancelled: Boolean(is_cancelled),
      override_duration_mins: override_duration_mins != null ? Number(override_duration_mins) : null,
      override_rate_per_hour: override_rate_per_hour != null ? Number(override_rate_per_hour) : null,
      override_type: override_type || null,
      override_start_time: override_start_time || null,
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Modify this and all future — splits schedule at occurrence_date
router.post('/:id/split', async (req, res) => {
  try {
    const { occurrence_date, day_of_week, start_time, duration_mins, rate_per_hour, type, num_students, notes } = req.body;
    const owner = req.session.user.email;
    const schedules = await db.getSchedules(owner);
    const current = schedules.find((s) => s.id === Number(req.params.id));
    if (!current) return res.status(404).json({ error: 'Not found' });

    // End current schedule the day before
    const prev = new Date(occurrence_date);
    prev.setDate(prev.getDate() - 1);
    await db.updateSchedule(req.params.id, owner, { ...current, effective_until: prev.toISOString().slice(0, 10) });

    // Create new schedule from occurrence_date
    const newSchedule = await db.addSchedule(owner, {
      student_id: current.student_id,
      day_of_week: Number(day_of_week),
      start_time,
      duration_mins: Number(duration_mins),
      rate_per_hour: Number(rate_per_hour),
      type,
      num_students: Number(num_students || 1),
      effective_from: occurrence_date,
      effective_until: null,
      notes: notes ?? current.notes ?? null,
    });
    res.json(newSchedule);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
