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
    const withNames = lessons.map((l) => {
      const s = students.find((s) => s.id === l.student_id);
      return { ...l, student_name: s ? s.name : '' };
    });
    res.json(withNames);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { student_id, date, type, duration_mins, rate_per_hour, num_students } = req.body;
    res.json(await db.addLesson(req.session.user.email, {
      student_id: Number(student_id), date, type,
      duration_mins: Number(duration_mins), rate_per_hour: Number(rate_per_hour),
      num_students: Number(num_students || 1),
    }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { date, type, duration_mins, rate_per_hour, num_students } = req.body;
    const updated = await db.updateLesson(req.params.id, req.session.user.email, {
      date, type, duration_mins: Number(duration_mins), rate_per_hour: Number(rate_per_hour),
      num_students: Number(num_students || 1),
    });
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
