const express = require('express');
const { getRates, SUPPORTED } = require('../services/currency');

const router = express.Router();

// GET /api/currency/rates?base=USD
// Public, no auth needed — display currency is a preference stored client
// side (localStorage), not tied to an account.
router.get('/rates', async (req, res) => {
  try {
    const base = String(req.query.base || 'USD').toUpperCase();
    const { rates, fetchedAt } = await getRates(base);
    res.json({ base, rates, fetchedAt, supported: SUPPORTED });
  } catch (err) {
    res.status(503).json({ error: 'Exchange rates are temporarily unavailable.' });
  }
});

module.exports = router;
