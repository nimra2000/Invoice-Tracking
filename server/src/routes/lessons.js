const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const { student_id, month } = req.query;
  const owner = req.session.user.email;
  const lessons = db.getLessons(owner, { student_id, month });
  const students = db.getStudents(owner);
  const withNames = lessons.map((l) => {
    const s = students.find((s) => s.id === l.student_id);
    return { ...l, student_name: s ? s.name : '' };
  });
  res.json(withNames);
});

router.post('/', (req, res) => {
  const { student_id, date, type, duration_mins, rate_per_hour, num_students } = req.body;
  res.json(db.addLesson(req.session.user.email, {
    student_id: Number(student_id), date, type,
    duration_mins: Number(duration_mins), rate_per_hour: Number(rate_per_hour),
    num_students: Number(num_students || 1),
  }));
});

router.put('/:id', (req, res) => {
  const { date, type, duration_mins, rate_per_hour, num_students } = req.body;
  const updated = db.updateLesson(req.params.id, req.session.user.email, {
    date, type, duration_mins: Number(duration_mins), rate_per_hour: Number(rate_per_hour),
    num_students: Number(num_students || 1),
  });
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  db.deleteLesson(req.params.id, req.session.user.email);
  res.json({ success: true });
});

module.exports = router;
