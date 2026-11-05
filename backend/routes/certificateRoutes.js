const express = require('express');
const router = express.Router();
const {
  getMyCertificates,
  downloadCertificatePDF
} = require('../controllers/certificateController');
const { protect } = require('../middleware/authMiddleware');

router.get('/my-certificates', protect, getMyCertificates);
router.get('/download/:bookingId', protect, downloadCertificatePDF);

module.exports = router;

