/**
 * routes/auth.js
 * Updated: upload features disabled (local-only / placeholder), preserved:
 * - registration
 * - login (file-local and db-local via passport)
 * - logout
 * - email verification (nodemailer)
 * - optional Twilio SMS sending
 * - JWT token issuance (optional route)
 *
 * Note: This file assumes models.User exists with fields used below.
 */

const express = require('express');
const router = express.Router();
const passport = require('passport');
const { check, body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');

// DB models
const initModels = require('../models/init-models');
const sequelize = require('../config/db/db_sequelise');
const models = initModels(sequelize);

// Utilities / config
const logger = console;
const JWT_SECRET = process.env.JWT_SECRET || 'jwt_dev_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Twilio (optional - will only be used when env vars present)
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  try {
    twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  } catch (err) {
    logger.warn('Twilio client init failed:', err.message);
    twilioClient = null;
  }
}

// Nodemailer transporter (simple SMTP - configure via env)
let mailTransporter = null;
if (process.env.EMAIL_HOST && process.env.EMAIL_ADDRESS && process.env.EMAIL_PASSWORD) {
  mailTransporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: (process.env.EMAIL_SECURE === 'true'), // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_ADDRESS,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
} else {
  logger.warn('Email config not fully supplied. Email features will be disabled.');
}

/* ---------- Helper functions ---------- */

async function sendVerificationEmail(user) {
  if (!mailTransporter) return false;
  const verifyToken = uuidv4();
  // In production you'd persist the token and expiration to DB; for simplicity we include in link
  const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verifyToken}&email=${encodeURIComponent(user.email)}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_ADDRESS,
    to: user.email,
    subject: 'Verify your FoodPrint account',
    text: `Hello ${user.firstName || ''},\n\nPlease verify your email by visiting: ${verifyUrl}\n\nIf you did not register, ignore this email.`,
    html: `<p>Hello ${user.firstName || ''},</p><p>Please verify your email by clicking <a href="${verifyUrl}">this link</a>.</p>`,
  };

  try {
    await mailTransporter.sendMail(mailOptions);
    return true;
  } catch (err) {
    logger.error('Failed to send verification email:', err.message);
    return false;
  }
}

async function sendSms(to, bodyText) {
  if (!twilioClient) return false;
  try {
    await twilioClient.messages.create({
      body: bodyText,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to,
    });
    return true;
  } catch (err) {
    logger.error('Failed to send SMS:', err.message);
    return false;
  }
}

/* ---------- Routes ---------- */

// GET /login
router.get('/login', (req, res) => {
  if (req.user) {
    return res.redirect('/');
  }
  res.render('login', { title: 'FoodPrint - Login', user: req.user });
});

// POST /login - using passport strategies defined in server.js (file-local / db-local)
router.post(
  '/login',
  passport.authenticate('file-local', {
    successReturnToOrRedirect: '/',
    failureRedirect: '/app/auth/login',
    failureFlash: true,
  })
);

// Alternative DB login (if using db-local)
router.post(
  '/dblogin',
  passport.authenticate('db-local', {
    successReturnToOrRedirect: '/',
    failureRedirect: '/app/auth/login',
    failureFlash: true,
  })
);

// Logout
router.get('/logout', (req, res, next) => {
  req.logout(function (err) {
    if (err) return next(err);
    req.flash('success', 'You are now logged out.');
    return res.redirect('/app/auth/login');
  });
});

// GET /register - render registration form
router.get('/register', (req, res) => {
  res.render('register', { title: 'FoodPrint - Register', user: req.user });
});

// POST /register - create user (uploads disabled)
router.post(
  '/register',
  [
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
    body('phoneNumber').optional().trim(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // return validation errors to the form
      req.flash('error', errors.array().map(e => e.msg).join(', '));
      return res.redirect('/app/auth/register');
    }

    try {
      const { firstName, lastName, email, phoneNumber, password } = req.body;
      // Check if user exists
      const existing = await models.User.findOne({ where: { email } });
      if (existing) {
        req.flash('error', 'A user with that email already exists.');
        return res.redirect('/app/auth/register');
      }

      const hashed = await bcrypt.hash(password, 10);
      const newUser = await models.User.create({
        firstName,
        lastName,
        email,
        phoneNumber,
        password: hashed,
        role: 'User',
        registrationChannel: 'web',
        // profile image / uploads intentionally disabled
        user_identifier_image_url: null,
        // other fields defaulted by model
      });

      // Send verification email (best-effort)
      const emailSent = await sendVerificationEmail(newUser);
      if (emailSent) {
        logger.info('Verification email sent to', email);
      }

      // Optionally send welcome SMS if phone provided and twilio configured
      if (phoneNumber) {
        await sendSms(phoneNumber, `Welcome to FoodPrint, ${firstName || ''}!`);
      }

      req.flash('success', 'Registration submitted. Please check your email for verification (if configured).');
      return res.redirect('/app/auth/login');
    } catch (err) {
      logger.error('Registration error:', err);
      req.flash('error', 'Registration failed. Please try again.');
      return res.redirect('/app/auth/register');
    }
  }
);

// Simple route to issue JWT after successful credential check (example)
// POST /token (expects email and password) - returns JWT
router.post(
  '/token',
  [body('email').isEmail(), body('password').isLength({ min: 1 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    try {
      const user = await models.User.findOne({ where: { email } });
      if (!user) return res.status(401).json({ message: 'Invalid credentials' });

      const match = await bcrypt.compare(password, user.password || '');
      if (!match) return res.status(401).json({ message: 'Invalid credentials' });

      const payload = { id: user.ID || user.id, email: user.email, role: user.role };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
      return res.json({ token, user: { id: payload.id, email: payload.email, role: payload.role } });
    } catch (err) {
      logger.error('Token error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
);

// GET /me - example protected route (expects passport JWT strategy to be configured in server)
router.get('/me', passport.authenticate('jwt', { session: false }), (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
