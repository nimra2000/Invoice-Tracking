const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { student_id, month } = req.query;
    const owner = req.session.user.email;
    const [lessons, students] = await Promise.all([
      db.getLessons(owner, { student_id, month }),
      db.getStudents(owner),
    ]);
    const byId = new Map(students.map((s) => [s.id, s.name]));
    const withNames = lessons.map((l) => ({
      ...l,
      skater_names: (l.skater_ids || []).map((id) => byId.get(id) || ''),
      // Keep student_name for single-skater compatibility with older UI code.
      student_name: byId.get(l.student_id) || '',
    }));
    res.json(withNames);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

function readLessonBody(body) {
  const skater_ids = Array.isArray(body.skater_ids)
    ? body.skater_ids.map(Number).filter((n) => Number.isFinite(n))
    : body.student_id != null
    ? [Number(body.student_id)]
    : [];
  return {
    skater_ids,
    date: body.date,
    start_time: body.start_time || null,
    billing_type: body.billing_type || 'private',
    pricing_type: body.pricing_type || 'hourly',
    duration_mins: body.duration_mins != null ? Number(body.duration_mins) : null,
    rate_per_hour: body.rate_per_hour != null ? Number(body.rate_per_hour) : null,
    flat_amount: body.flat_amount != null ? Number(body.flat_amount) : null,
    notes: body.notes || null,
  };
}

router.post('/', async (req, res) => {
  try {
    const payload = readLessonBody(req.body);
    if (payload.skater_ids.length === 0) {
      return res.status(400).json({ error: 'At least one skater is required' });
    }
    res.json(await db.addLesson(req.session.user.email, payload));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const payload = readLessonBody(req.body);
    if (payload.skater_ids.length === 0) {
      return res.status(400).json({ error: 'At least one skater is required' });
    }
    const updated = await db.updateLesson(req.params.id, req.session.user.email, payload);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.deleteLesson(req.params.id, req.session.user.email);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
