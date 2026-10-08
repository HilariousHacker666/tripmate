const crypto = require('crypto');
const config = require('../config');

// CSRF Cookie Name and Header Name
const CSRF_COOKIE_NAME = 'XSRF-TOKEN';
const CSRF_HEADER_NAME = 'x-csrf-token';

function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

function csrfProtection(req, res, next) {
  // If GET, HEAD, OPTIONS, generate CSRF token cookie if not present, and proceed
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  
  if (safeMethods.includes(req.method)) {
    if (!req.cookies[CSRF_COOKIE_NAME]) {
      const token = generateCsrfToken();
      res.cookie(CSRF_COOKIE_NAME, token, {
        httpOnly: false, // Double submit pattern: JavaScript needs to read this cookie to set the header
        sameSite: 'Strict',
        secure: config.isProduction,
        path: '/'
      });
      req.csrfToken = token;
    } else {
      req.csrfToken = req.cookies[CSRF_COOKIE_NAME];
    }
    return next();
  }

  // State-changing methods (POST, PUT, DELETE, PATCH): verify token
  // Double-submit cookie verification: cookie must match header
  const cookieToken = req.cookies[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME] || req.body?._csrf;

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({
      success: false,
      error: 'Invalid or missing CSRF token. Cross-Site Request Forgery attempt blocked.'
    });
  }

  next();
}

module.exports = {
  csrfProtection,
  generateCsrfToken,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME
};
