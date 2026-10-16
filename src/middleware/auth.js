const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Extract token from 'Bearer <token>'
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'default_jwt_secret_key_change_in_production'
      );

      // Find user by decoded ID, excluding password
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User belonging to this token no longer exists',
        });
      }

      req.user = user;
      next();
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('JWT Auth Error:', error.message);
      }
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token failed or expired',
        error: error.message,
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token provided. Please provide a Bearer token.',
    });
  }
};

// Optional auth: attaches req.user if valid token provided, but doesn't block if missing
const optionalAuth = async (req, res, next) => {
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'default_jwt_secret_key_change_in_production'
      );
      req.user = await User.findById(decoded.id).select('-password');
    } catch (err) {
      // Ignore token verification errors for optional auth
    }
  }
  next();
};

module.exports = { protect, optionalAuth };
