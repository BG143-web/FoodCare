const express = require('express');
const router = express.Router();
const foodController = require('../controllers/foodController');
const authenticateToken = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');

// Public endpoints
router.get('/', foodController.getAllFoods);
router.get('/:id', foodController.getFoodById);

// Donor-only endpoints
router.post('/', authenticateToken, requireRole('donor'), foodController.createFood);
router.put('/:id', authenticateToken, requireRole('donor'), foodController.updateFood);
router.delete('/:id', authenticateToken, requireRole('donor'), foodController.deleteFood);

module.exports = router;
