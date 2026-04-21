const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  try { res.json(await db.getProfile(req.session.user.email) || {}); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/', async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      address,
      website,
      tax_number,
      payment_instructions_etransfer,
      accepts_cheque_cash,
      default_hourly_rate,
    } = req.body;
    res.json(await db.setProfile(req.session.user.email, {
      name,
      email,
      phone,
      address,
      website,
      tax_number,
      payment_instructions_etransfer,
      accepts_cheque_cash: Boolean(accepts_cheque_cash),
      default_hourly_rate: default_hourly_rate != null ? Number(default_hourly_rate) : undefined,
    }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
