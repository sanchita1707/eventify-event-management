const express = require('express');
const router = express.Router();
const {
  getUserProfile,
  getCustomerDashboard,
  updateUserProfile,
  updatePassword,
  submitContactMessage
} = require('../controllers/userController');
const { protect, optionalAuth } = require('../middleware/authMiddleware');

router.get('/dashboard', protect, getCustomerDashboard);
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);
router.put('/password', protect, updatePassword);
router.post('/contact', optionalAuth, submitContactMessage);

module.exports = router;

