const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => res.json(db.getStudents(req.session.user.email)));

router.get('/:id', (req, res) => {
  const student = db.getStudent(req.params.id, req.session.user.email);
  if (!student) return res.status(404).json({ error: 'Not found' });
  res.json(student);
});

router.post('/', (req, res) => {
  const { name, email } = req.body;
  res.json(db.addStudent(req.session.user.email, { name, email }));
});

router.put('/:id', (req, res) => {
  const { name, email, balance } = req.body;
  const updated = db.updateStudent(req.params.id, req.session.user.email, { name, email, balance: Number(balance || 0) });
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  db.deleteStudent(req.params.id, req.session.user.email);
  res.json({ success: true });
});

// Balance entries
router.get('/:id/balance', (req, res) => {
  const entries = db.getBalanceEntries(req.params.id, req.session.user.email);
  if (entries === null) return res.status(404).json({ error: 'Not found' });
  res.json(entries);
});

router.post('/:id/balance', (req, res) => {
  const { date, description, amount, settled } = req.body;
  const entry = db.addBalanceEntry(req.params.id, req.session.user.email, {
    date, description, amount: Number(amount), settled: Boolean(settled),
  });
  if (!entry) return res.status(404).json({ error: 'Not found' });
  res.json(entry);
});

router.put('/:id/balance/:entryId', (req, res) => {
  const { date, description, amount, settled } = req.body;
  const updated = db.updateBalanceEntry(req.params.id, req.session.user.email, req.params.entryId, {
    date, description, amount: Number(amount), settled: Boolean(settled),
  });
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json(updated);
});

router.delete('/:id/balance/:entryId', (req, res) => {
  db.deleteBalanceEntry(req.params.id, req.session.user.email, req.params.entryId);
  res.json({ success: true });
});

module.exports = router;
