const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  try { res.json(await db.getProfile(req.session.user.email) || {}); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/', async (req, res) => {
  try {
    const { name, email, address, phone } = req.body;
    res.json(await db.setProfile(req.session.user.email, { name, email, address, phone }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
