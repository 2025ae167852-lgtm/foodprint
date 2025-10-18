// routes/blockchain.js
// BLOCKCHAIN: DISABLED SAFE STUB
// This file intentionally disables blockchain functionality so the
// app can run in environments where Algorand or related env vars/SDK
// are not available (eg. Render).
//
// It provides the same route endpoints used throughout the app but
// returns 503 / a consistent JSON response indicating the feature
// is disabled. This prevents crashes from missing env variables,
// missing SDKs or failed network connections.

const express = require('express');
const router = express.Router();

/**
 * Standard response when blockchain is disabled.
 * Use this helper for consistency and easy change later.
 */
function blockchainDisabledResponse(res, routeName = '') {
  return res.status(503).json({
    success: false,
    message:
      'Blockchain functionality is disabled for this deployment. ' +
      (routeName ? `Requested route: ${routeName}.` : ''),
    hint:
      'If you want to enable blockchain, set the necessary environment ' +
      'variables and re-enable the blockchain module. For now, data will be stored only in the DB.'
  });
}

/**
 * GET /app/test/blockchain/algod
 * This used to check algod node status. When disabled, return 503.
 */
router.get('/app/test/blockchain/algod', (req, res) => {
  return blockchainDisabledResponse(res, '/app/test/blockchain/algod');
});

/**
 * POST /app/harvest/save/blockchain
 * This used to submit harvest logs to Algorand. When disabled, we still
 * accept the payload and return a 503 with informative message. If you
 * want to persist a record in DB only (no blockchain), extend this
 * handler to save to DB.
 */
router.post('/app/harvest/save/blockchain', (req, res) => {
  // Optionally log the payload for debugging (comment out if noisy)
  // console.log('Blockchain disabled - received harvest payload:', req.body);

  // Return a consistent disabled response
  return blockchainDisabledResponse(res, '/app/harvest/save/blockchain');
});

/**
 * POST /app/storage/save/blockchain
 * Same behavior as harvest endpoint — storage blockchain logging is disabled.
 */
router.post('/app/storage/save/blockchain', (req, res) => {
  // console.log('Blockchain disabled - received storage payload:', req.body);
  return blockchainDisabledResponse(res, '/app/storage/save/blockchain');
});

/**
 * Generic catch-all for any other blockchain endpoints the app might call.
 * Returns the same disabled response.
 */
router.all('*', (req, res) => {
  return blockchainDisabledResponse(res, `BLOCKCHAIN_ROUTE ${req.method} ${req.originalUrl}`);
});

module.exports = router;
