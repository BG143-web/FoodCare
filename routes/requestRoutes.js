const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');
const authenticateToken = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');

// GET /api/requests - Authenticated users (donors see incoming claims, seekers see submitted claims)
router.get('/', authenticateToken, requestController.getAllRequests);

// POST /api/requests - Seekers only
router.post('/', authenticateToken, requireRole('seeker'), requestController.createRequest);

// PUT /api/requests/:id/status - Status transitions (Accepted, Rejected, Completed)
router.put('/:id/status', authenticateToken, requestController.updateRequestStatus);
router.put('/:id', authenticateToken, requestController.updateRequestStatus);

module.exports = router;
