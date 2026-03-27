const express = require('express');
const { chatHandler, healthCheck, clearHistory, autofillRegionHandler } = require('../controllers/geminiController');
const rateLimit = require('../middleware/rateLimit');

const router = express.Router();

// Autofill region data
router.post('/autofill-region', autofillRegionHandler);

// Chat endpoint with rate limiting
router.post('/chat', rateLimit, chatHandler);

// Health check endpoint (no rate limiting needed for health check)
router.get('/health', healthCheck);

// Clear conversation history
router.post('/clear-history', clearHistory);

module.exports = router;