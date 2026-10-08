const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { getDb } = require('../db');
const { userRegistrationValidation, userLoginValidation } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { logAudit } = require('../services/auditService');

const router = express.Router();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

/**
 * POST /api/auth/register
 * Requirement: SR-01 Password policy (min 10 chars, complexity), bcrypt cost >= 12
 */
router.post('/register', userRegistrationValidation, async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    const db = getDb();

    // Check if email already registered
    const existing = db.prepare('SELECT id FROM Users WHERE email = ?').get(email);
    if (existing) {
      logAudit({
        action: 'AUTH_REGISTER_FAIL_EXISTS',
        details: { email },
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
      return res.status(409).json({
        success: false,
        error: 'An account with this email address already exists.'
      });
    }

    // Hash password with bcrypt cost >= 12
    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
    const userId = uuidv4();

    db.prepare(`
      INSERT INTO Users (id, email, password_hash, name)
      VALUES (?, ?, ?, ?)
    `).run(userId, email, passwordHash, name);

    logAudit({
      userId,
      action: 'AUTH_REGISTER_SUCCESS',
      details: { email, name },
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json({
      success: true,
      message: 'Account registered successfully. Please proceed to login.',
      user: { id: userId, email, name }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 * Requirement: Account lockout / rate limiting on login (5 failed attempts), JWT HttpOnly cookie
 */
router.post('/login', userLoginValidation, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const db = getDb();

    const user = db.prepare(`
      SELECT id, email, password_hash, name, failed_login_attempts, locked_until 
      FROM Users 
      WHERE email = ?
    `).get(email);

    if (!user) {
      logAudit({
        action: 'AUTH_LOGIN_FAIL_USER_NOT_FOUND',
        details: { email },
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.'
      });
    }

    // Check account lockout
    if (user.locked_until) {
      const lockDate = new Date(user.locked_until);
      if (lockDate > new Date()) {
        logAudit({
          userId: user.id,
          action: 'AUTH_LOGIN_LOCKED',
          details: { lockedUntil: user.locked_until },
          ip: req.ip,
          userAgent: req.get('user-agent')
        });
        const remainingMin = Math.ceil((lockDate - new Date()) / (1000 * 60));
        return res.status(403).json({
          success: false,
          error: `Account is temporarily locked due to multiple failed login attempts. Try again in ${remainingMin} minute(s).`
        });
      } else {
        // Lock expired, reset failed attempts
        db.prepare('UPDATE Users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);
        user.failed_login_attempts = 0;
      }
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      const newAttempts = (user.failed_login_attempts || 0) + 1;
      let lockoutTime = null;

      if (newAttempts >= MAX_FAILED_ATTEMPTS) {
        lockoutTime = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
        db.prepare('UPDATE Users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?')
          .run(newAttempts, lockoutTime, user.id);
        
        logAudit({
          userId: user.id,
          action: 'AUTH_ACCOUNT_LOCKOUT_TRIGGERED',
          details: { attempts: newAttempts, lockedUntil: lockoutTime },
          ip: req.ip,
          userAgent: req.get('user-agent')
        });

        return res.status(403).json({
          success: false,
          error: `Account locked for ${LOCKOUT_MINUTES} minutes due to ${MAX_FAILED_ATTEMPTS} consecutive failed login attempts.`
        });
      } else {
        db.prepare('UPDATE Users SET failed_login_attempts = ? WHERE id = ?')
          .run(newAttempts, user.id);
        
        logAudit({
          userId: user.id,
          action: 'AUTH_LOGIN_FAIL_BAD_PASSWORD',
          details: { attempts: newAttempts },
          ip: req.ip,
          userAgent: req.get('user-agent')
        });

        return res.status(401).json({
          success: false,
          error: 'Invalid email or password.'
        });
      }
    }

    // Login successful: reset failed attempts
    db.prepare('UPDATE Users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);

    // Issue short-lived JWT token (15 mins)
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      config.jwtSecret,
      { expiresIn: config.jwtExpiry }
    );

    // Set secure HttpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: config.isProduction, // HTTPS in production
      sameSite: 'Strict',
      maxAge: 15 * 60 * 1000,
      path: '/'
    });

    logAudit({
      userId: user.id,
      action: 'AUTH_LOGIN_SUCCESS',
      details: { email: user.email },
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({
      success: true,
      message: 'Login successful.',
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      token // also return in body for headless testing/clients
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  const token = req.cookies?.token;
  let userId = null;
  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      userId = decoded.userId;
    } catch {
      // Ignore invalid token during logout
    }
  }

  res.clearCookie('token', {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'Strict',
    path: '/'
  });

  logAudit({
    userId,
    action: 'AUTH_LOGOUT',
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  res.json({
    success: true,
    message: 'Logged out successfully.'
  });
});

/**
 * GET /api/auth/me
 */
router.get('/me', requireAuth, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

module.exports = router;
