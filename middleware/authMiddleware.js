const jwt = require('jsonwebtoken');

/**
 * Authentication Middleware
 * 
 * Verifies JWT token from either:
 * 1. HTTP-only cookie ('token')
 * 2. Authorization header ('Bearer <token>')
 * 
 * Attaches decoded user payload { id, email, role } to req.user.
 */
const authenticateToken = (req, res, next) => {
  let token = null;

  // 1. Read from HTTP-only cookie
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  // 2. Fallback to Authorization: Bearer <token>
  if (!token && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
  }

  // If no token found
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. No token provided.'
    });
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('CRITICAL: JWT_SECRET environment variable is missing.');
      return res.status(500).json({
        success: false,
        error: 'Authentication configuration error.'
      });
    }
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Authentication failed. Token has expired.'
      });
    }
    return res.status(401).json({
      success: false,
      error: 'Authentication failed. Invalid token.'
    });
  }
};

authenticateToken.authenticateToken = authenticateToken;
module.exports = authenticateToken;
