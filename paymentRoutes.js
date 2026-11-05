const express = require('express');
const router = express.Router();
const {
  createPaymentOrder,
  authorizeTestSandboxPayment,
  verifyPayment,
  markPaymentFailed
} = require('../controllers/bookingController');
const { protect } = require('../middleware/authMiddleware');

router.post('/create-order', protect, createPaymentOrder);
router.post('/test-authorize', protect, authorizeTestSandboxPayment);
router.post('/verify', protect, verifyPayment);
router.post('/failed', protect, markPaymentFailed);

module.exports = router;

