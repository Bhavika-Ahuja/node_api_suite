const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes (Requires Bearer <JWT_TOKEN>)
router.get('/me', protect, getMe);

module.exports = router;
