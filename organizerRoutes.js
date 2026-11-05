const express = require('express');
const router = express.Router();
const {
  getOrganizerDashboard,
  getOrganizerEvents,
  getOrganizerBookings
} = require('../controllers/organizerController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect, authorize('organizer', 'admin'));

router.get('/dashboard', getOrganizerDashboard);
router.get('/events', getOrganizerEvents);
router.get('/bookings', getOrganizerBookings);

module.exports = router;

