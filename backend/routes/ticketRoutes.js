const express = require('express');
const router = express.Router();
const { getTicket, scanAndValidateTicket } = require('../controllers/ticketController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/scan', protect, authorize('organizer', 'admin'), scanAndValidateTicket);
router.get('/:id', protect, getTicket);

module.exports = router;

