const express = require('express');
const router = express.Router();
const {
  getNotifications,
  markNotificationsRead
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getNotifications);
router.put('/mark-read', protect, markNotificationsRead);
router.put('/read-all', protect, markNotificationsRead);

module.exports = router;

