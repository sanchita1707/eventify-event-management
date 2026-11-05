const express = require('express');
const router = express.Router();
const { chatWithAI } = require('../controllers/aiController');
const { optionalAuth } = require('../middleware/authMiddleware');

router.post('/chat', optionalAuth, chatWithAI);

module.exports = router;

