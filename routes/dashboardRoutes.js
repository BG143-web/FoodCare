const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const authenticateToken = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');

// Donor-only dashboard endpoint
router.get('/donor/dashboard', authenticateToken, requireRole('donor'), dashboardController.getDonorDashboard);

// Seeker-only dashboard endpoint
router.get('/seeker/dashboard', authenticateToken, requireRole('seeker'), dashboardController.getSeekerDashboard);

module.exports = router;
