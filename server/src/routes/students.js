const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  try { res.json(await db.getStudents(req.session.user.email)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const student = await db.getStudent(req.params.id, req.session.user.email);
    if (!student) return res.status(404).json({ error: 'Not found' });
    res.json(student);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, email } = req.body;
    res.json(await db.addStudent(req.session.user.email, { name, email }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, email } = req.body;
    const updated = await db.updateStudent(req.params.id, req.session.user.email, { name, email });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.deleteStudent(req.params.id, req.session.user.email);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Balance entries
router.get('/:id/balance', async (req, res) => {
  try {
    const entries = await db.getBalanceEntries(req.params.id, req.session.user.email);
    if (entries === null) return res.status(404).json({ error: 'Not found' });
    res.json(entries);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/balance', async (req, res) => {
  try {
    const { date, description, amount, settled } = req.body;
    const entry = await db.addBalanceEntry(req.params.id, req.session.user.email, {
      date, description, amount: Number(amount), settled: Boolean(settled),
    });
    if (!entry) return res.status(404).json({ error: 'Not found' });
    res.json(entry);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/balance/:entryId', async (req, res) => {
  try {
    const { date, description, amount, settled } = req.body;
    const updated = await db.updateBalanceEntry(req.params.id, req.session.user.email, req.params.entryId, {
      date, description, amount: Number(amount), settled: Boolean(settled),
    });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id/balance/:entryId', async (req, res) => {
  try {
    await db.deleteBalanceEntry(req.params.id, req.session.user.email, req.params.entryId);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
