const express = require('express');
const router = express.Router();
const {
  getEventReviews,
  createReview,
  deleteReview
} = require('../controllers/reviewController');
const { protect } = require('../middleware/authMiddleware');

router.get('/event/:eventId', getEventReviews);
router.post('/', protect, createReview);
router.delete('/:id', protect, deleteReview);

module.exports = router;

