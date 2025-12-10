const express = require('express');
const router = express.Router();
const passport = require('passport');
const ROLES = require('../utils/roles');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const initModels = require('../models/init-models');
const sequelize = require('../config/db/db_sequelise');
const models = initModels(sequelize);

// Twilio (optional, only if EMAIL_ENABLED or SMS needed)
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
let tw_client;
if (accountSid && authToken) {
  tw_client = require('twilio')(accountSid, authToken);
}

/* Render Login page */
router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/');
  res.render('login', {
    title: 'FoodPrint - User Login',
    user: req.user,
    page_name: 'login',
  });
});

/* Process Login */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Basic guards
    if (!email || !password) {
      req.flash('error', 'Email and password are required.');
      return res.redirect('/app/auth/login');
    }

    let user = await models.User.findOne({ where: { email } });

    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/app/auth/login');
    }

    if (!user.passwordHash) {
      req.flash('error', 'Password not set. Contact admin.');
      return res.redirect('/app/auth/login');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      req.flash('error', 'Invalid email or password');
      return res.redirect('/app/auth/login');
    }

    req.login(user, err => {
      if (err) {
        console.error('Login error:', err);
        req.flash('error', 'Login failed');
        return res.redirect('/app/auth/login');
      }
      req.flash('success', 'Login successful!');
      return res.redirect('/');
    });
  } catch (err) {
    console.error('Login error:', err);
    req.flash('error', 'Login failed: ' + err.message);
    res.redirect('/app/auth/login');
  }
});

/* Logout */
router.get('/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    req.flash('success', 'You are now logged out.');
    res.redirect('/app/auth/login');
  });
});

/* Render Register page */
router.get('/register/:message?', (req, res) => {
  const isMessage = req.params.message;
  res.render(isMessage ? 'message' : 'register', {
    title: 'FoodPrint - User Registration',
    user: req.user,
    page_name: isMessage ? 'message' : 'register',
    message: isMessage
      ? 'Registration successful! Please login with your email and password.'
      : null,
  });
});

/* Register User (SAFE) */
router.post('/register', async (req, res) => {
  try {
    const {
      name,
      surname,
      email,
      confirmEmail,
      password,
      confirmPassword,
      phone,
      userType
    } = req.body;

    // Guards for required fields
    if (!email || !confirmEmail) {
      req.flash('error', 'Email and confirmation are required.');
      return res.redirect('/app/auth/register');
    }
    if (!password || !confirmPassword) {
      req.flash('error', 'Password and confirmation are required.');
      return res.redirect('/app/auth/register');
    }

    // Validate email and password
    if (email !== confirmEmail) {
      req.flash('error', 'Email addresses do not match.');
      return res.redirect('/app/auth/register');
    }
    if (password !== confirmPassword) {
      req.flash('error', 'Passwords do not match.');
      return res.redirect('/app/auth/register');
    }
    if (password.length < 6) {
      req.flash('error', 'Password must be at least 6 characters long.');
      return res.redirect('/app/auth/register');
    }

    // Existing user check
    const existingUser = await models.User.findOne({ where: { email } });
    if (existingUser) {
      req.flash('error', 'Email already registered.');
      return res.redirect('/app/auth/register');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // Create new user
    await models.User.create({
      firstName: name || '',
      lastName: surname || '',
      email,
      phoneNumber: phone || `+254${Math.floor(Math.random() * 9000000000)}`,
      passwordHash: hash,
      role: userType || ROLES.User,
      registrationChannel: 'web',
    });

    req.flash('success', 'Registration successful! You can now login.');
    res.redirect('/app/auth/register/message');
  } catch (err) {
    console.error('Registration error:', err);
    req.flash('error', 'Registration failed: ' + (err.message || 'Unknown error'));
    res.redirect('/app/auth/register');
  }
});

/* Forgot Password */
router.get('/forgot-password', (req, res) => {
  res.render('forgot-password', {
    title: 'FoodPrint - Forgot Password',
    user: req.user,
    page_name: 'forgot-password',
  });
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      req.flash('success', 'If an account exists, a reset link has been sent.');
      return res.redirect('/app/auth/login');
    }

    const user = await models.User.findOne({ where: { email } });

    if (!user) {
      req.flash('success', 'If an account exists, a reset link has been sent.');
      return res.redirect('/app/auth/login');
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    await models.User.update(
      { passwordResetToken: resetToken, passwordResetExpires: resetExpires },
      { where: { email } }
    );

    // TODO: Send email/SMS here using configured provider
    console.log(`Reset link: https://yourdomain.com/app/auth/reset-password?token=${resetToken}&email=${email}`);

    req.flash('success', 'If an account exists, a reset link has been sent.');
    res.redirect('/app/auth/login');
  } catch (err) {
    console.error('Forgot password error:', err);
    req.flash('error', 'An error occurred. Please try again.');
    res.redirect('/app/auth/forgot-password');
  }
});

/* Reset Password (SAFE) */
router.get('/reset-password', async (req, res) => {
  try {
    const { token, email } = req.query;
    if (!token || !email) {
      req.flash('error', 'Invalid reset link.');
      return res.redirect('/app/auth/login');
    }

    const { Op } = require('sequelize');
    const user = await models.User.findOne({
      where: {
        email,
        passwordResetToken: token,
        passwordResetExpires: { [Op.gt]: new Date() },
      },
    });

    if (!user) {
      req.flash('error', 'Invalid or expired reset link.');
      return res.redirect('/app/auth/login');
    }

    res.render('reset-password', {
      title: 'FoodPrint - Reset Password',
      user: req.user,
      page_name: 'reset-password',
      token,
      email,
    });
  } catch (err) {
    console.error('Reset password error:', err);
    req.flash('error', 'An error occurred. Please try again.');
    res.redirect('/app/auth/login');
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, email, password, confirmPassword } = req.body;

    // Guards for required fields
    if (!token || !email) {
      req.flash('error', 'Invalid reset request.');
      return res.redirect('/app/auth/login');
    }
    if (!password || !confirmPassword) {
      req.flash('error', 'Password and confirmation are required.');
      return res.redirect(`/app/auth/reset-password?token=${token}&email=${email}`);
    }

    // Validate password
    if (password !== confirmPassword) {
      req.flash('error', 'Passwords do not match.');
      return res.redirect(`/app/auth/reset-password?token=${token}&email=${email}`);
    }
    if (password.length < 6) {
      req.flash('error', 'Password must be at least 6 characters long.');
      return res.redirect(`/app/auth/reset-password?token=${token}&email=${email}`);
    }

    const { Op } = require('sequelize');
    const user = await models.User.findOne({
      where: {
        email,
        passwordResetToken: token,
        passwordResetExpires: { [Op.gt]: new Date() },
      },
    });

    if (!user) {
      req.flash('error', 'Invalid or expired reset link.');
      return res.redirect('/app/auth/login');
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    await models.User.update(
      { passwordHash: hash, passwordResetToken: null, passwordResetExpires: null },
      { where: { email } }
    );

    req.flash('success', 'Password reset successful! You can now login.');
    res.redirect('/app/auth/login');
  } catch (err) {
    console.error('Reset password error:', err);
    req.flash('error', 'An error occurred. Please try again.');
    res.redirect('/app/auth/login');
  }
});

module.exports = router;
