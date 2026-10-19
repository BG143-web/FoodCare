const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const authenticateToken = require('../middleware/authMiddleware');

// Public impact statistics summary
router.get('/stats/summary', statsController.getStatsSummary);
router.get('/summary', statsController.getStatsSummary);

// Authenticated distribution history (donors see completed donations; seekers see completed claims)
router.get('/history', authenticateToken, statsController.getHistory);

module.exports = router;
