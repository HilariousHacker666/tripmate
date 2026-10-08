const jwt = require('jsonwebtoken');
const config = require('../config');
const { getDb } = require('../db');
const { logAudit } = require('../services/auditService');

function requireAuth(req, res, next) {
  // Read token from secure HttpOnly cookie or Authorization header Bearer
  let token = req.cookies?.token;
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. No session token provided.'
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const db = getDb();
    const user = db.prepare('SELECT id, email, name, locked_until FROM Users WHERE id = ?').get(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid session. User no longer exists.'
      });
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(403).json({
        success: false,
        error: 'Account temporarily locked due to repeated failed logins. Please try again later.'
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name
    };

    next();
  } catch (err) {
    logAudit({
      action: 'AUTH_TOKEN_INVALID',
      details: { error: err.name, message: err.message },
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    return res.status(401).json({
      success: false,
      error: 'Invalid or expired session token.'
    });
  }
}

module.exports = {
  requireAuth
};
