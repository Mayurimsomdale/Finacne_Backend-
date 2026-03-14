  // middleware/authMiddleware.js
  const jwt = require('jsonwebtoken');
  const { query } = require('../config/database');

  // Verify JWT token and authenticate user
  exports.authenticate = async (req, res, next) => {
    try {
      // Get token from header
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'No token provided. Authorization denied.'
        });
      }

      // Extract token
      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check if user still exists and is active
        const result = await query(
          'SELECT id, username, role, is_active FROM admin_users WHERE id = $1',
          [decoded.id]
        );

        if (result.rows.length === 0) {
          return res.status(401).json({
            success: false,
            message: 'User not found. Authorization denied.'
          });
        }

        const user = result.rows[0];

        if (!user.is_active) {
          return res.status(403).json({
            success: false,
            message: 'Account is deactivated. Authorization denied.'
          });
        }

        // Attach user to request object
        req.user = {
          id: user.id,
          username: user.username,
          role: user.role
        };

        next();

      } catch (jwtError) {
        if (jwtError.name === 'TokenExpiredError') {
          return res.status(401).json({
            success: false,
            message: 'Token has expired. Please login again.'
          });
        }
        
        return res.status(401).json({
          success: false,
          message: 'Invalid token. Authorization denied.'
        });
      }

    } catch (error) {
      console.error('Authentication middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Authentication error',
        error: error.message
      });
    }
  };

  // Check if user has required role
  exports.authorize = (...roles) => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: `User role '${req.user.role}' is not authorized to access this resource. Required roles: ${roles.join(', ')}`
        });
      }

      next();
    };
  };