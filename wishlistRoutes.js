const express = require('express');
const router = express.Router();
const {
  getWishlist,
  toggleWishlist,
  removeFromWishlist
} = require('../controllers/wishlistController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getWishlist);
router.post('/toggle', protect, toggleWishlist);
router.delete('/:eventId', protect, removeFromWishlist);

module.exports = router;

