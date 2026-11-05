const express = require('express');
const router = express.Router();
const {
  initiateBooking,
  getBookingById,
  getMyBookings
} = require('../controllers/bookingController');
const { protect } = require('../middleware/authMiddleware');

router.post('/initiate', protect, initiateBooking);
router.get('/my-bookings', protect, getMyBookings);
router.get('/:id', protect, getBookingById);

module.exports = router;

