const express = require('express');
const router = express.Router();
const {
  getEvents,
  getRecommendedEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent
} = require('../controllers/eventController');
const { protect, optionalAuth, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.get('/', getEvents);
router.get('/recommendations', optionalAuth, getRecommendedEvents);
router.get('/:id', optionalAuth, getEventById);
router.post('/', protect, authorize('organizer', 'admin'), upload.single('poster'), createEvent);
router.put('/:id', protect, authorize('organizer', 'admin'), upload.single('poster'), updateEvent);
router.delete('/:id', protect, authorize('organizer', 'admin'), deleteEvent);

module.exports = router;

