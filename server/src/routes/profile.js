const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(db.getProfile(req.session.user.email) || {});
});

router.put('/', (req, res) => {
  const { name, email, address, phone } = req.body;
  res.json(db.setProfile(req.session.user.email, { name, email, address, phone }));
});

module.exports = router;
