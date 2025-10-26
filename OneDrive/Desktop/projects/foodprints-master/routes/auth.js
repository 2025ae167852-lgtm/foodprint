var express = require('express');
var router = express.Router();
var passport = require('passport');
var ROLES = require('../utils/roles');
const bcrypt = require('bcryptjs'); // ✅ USING bcryptjs for Render compatibility
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

var initModels = require('../models/init-models');
var sequelize = require('../config/db/db_sequelise');
var models = initModels(sequelize);

const { uploadFile, resolveFilenames } = require('../config/cloudinary/file-upload');

const { getMimeType } = require('../utils/image_mimetypes');
const { v4: uuidv4 } = require('uuid');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const tw_client = require('twilio')(accountSid, authToken);

/* Render Login page. */
router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/');
  res.render('login', {
    title: 'FoodPrint - User Login',
    user: req.user,
    page_name: 'login',
  });
});

/* Process Login (DB Auth using bcryptjs) */
router.post('/login', async (req, res) => {
  try {
    // Try to find user by email first
    let user = await models.User.findOne({ where: { email: req.body.loginUsername } });

    // If not found, try to find by username (for backwards compatibility)
    if (!user) {
      // Could also search by other fields if needed
      user = await models.User.findOne({ where: { firstName: req.body.loginUsername } });
    }

    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/app/auth/login');
    }

    // Check if passwordHash exists
    if (!user.passwordHash) {
      req.flash('error', 'Please contact administrator to reset your password');
      return res.redirect('/app/auth/login');
    }

    const isMatch = await bcrypt.compare(req.body.loginPassword, user.passwordHash);
    if (!isMatch) {
      req.flash('error', 'Invalid username or password');
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

/* Process Login (DB Auth using bcryptjs) - Legacy route */
router.post('/dblogin', async (req, res) => {
  try {
    const user = await models.User.findOne({ where: { email: req.body.email } });
    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/app/auth/login');
    }

    const isMatch = await bcrypt.compare(req.body.password, user.passwordHash);
    if (!isMatch) {
      req.flash('error', 'Invalid email or password');
      return res.redirect('/app/auth/login');
    }

    req.login(user, err => {
      if (err) throw err;
      return res.redirect('/');
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Login failed');
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

/* Register User (save hashed password) */
router.post('/register', async (req, res) => {
  try {
    // Validate passwords match
    if (req.body.registerPassword !== req.body.registerConfirmPassword) {
      req.flash('error', 'Passwords do not match.');
      return res.redirect('/app/auth/register');
    }

    // Validate password length
    if (req.body.registerPassword.length < 6) {
      req.flash('error', 'Password must be at least 6 characters long.');
      return res.redirect('/app/auth/register');
    }

    // Validate emails match
    if (req.body.registerEmail !== req.body.registerConfirmEmail) {
      req.flash('error', 'Email addresses do not match.');
      return res.redirect('/app/auth/register');
    }

    // Check if user already exists
    const existingUser = await models.User.findOne({
      where: {
        email: req.body.registerEmail,
      },
    });

    if (existingUser) {
      req.flash('error', 'Email already registered.');
      return res.redirect('/app/auth/register');
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(req.body.registerPassword, salt);

    await models.User.create({
      firstName: req.body.registerName || '',
      lastName: req.body.registerSurname || '',
      email: req.body.registerEmail,
      phoneNumber: req.body.registerPhone || `+254${Math.floor(Math.random() * 9000000000)}`,
      passwordHash: hash,
      role: req.body.registerUserType || ROLES.User,
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
    const user = await models.User.findOne({ where: { email } });

    if (!user) {
      // Don't reveal if user exists or not for security
      req.flash(
        'success',
        'If an account exists with that email, a password reset link has been sent.'
      );
      return res.redirect('/app/auth/login');
    }

    // Generate reset token
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date();
    resetExpires.setHours(resetExpires.getHours() + 1); // Token valid for 1 hour

    await models.User.update(
      {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      },
      { where: { email } }
    );

    // In production, send email with reset link
    // For now, just log the token
    console.log(`Password reset token for ${email}: ${resetToken}`);
    console.log(
      `Reset link: http://localhost:3000/app/auth/reset-password?token=${resetToken}&email=${email}`
    );

    req.flash(
      'success',
      'If an account exists with that email, a password reset link has been sent.'
    );
    res.redirect('/app/auth/login');
  } catch (err) {
    console.error('Forgot password error:', err);
    req.flash('error', 'An error occurred. Please try again.');
    res.redirect('/app/auth/forgot-password');
  }
});

/* Reset Password */
router.get('/reset-password', async (req, res) => {
  try {
    const { token, email } = req.query;

    if (!token || !email) {
      req.flash('error', 'Invalid reset link.');
      return res.redirect('/app/auth/login');
    }

    const user = await models.User.findOne({
      where: {
        email,
        passwordResetToken: token,
        passwordResetExpires: { [require('sequelize').Op.gt]: new Date() },
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

    // Validate passwords match
    if (password !== confirmPassword) {
      req.flash('error', 'Passwords do not match.');
      return res.render('reset-password', {
        title: 'FoodPrint - Reset Password',
        user: req.user,
        page_name: 'reset-password',
        token,
        email,
      });
    }

    // Validate password length
    if (password.length < 6) {
      req.flash('error', 'Password must be at least 6 characters long.');
      return res.render('reset-password', {
        title: 'FoodPrint - Reset Password',
        user: req.user,
        page_name: 'reset-password',
        token,
        email,
      });
    }

    // Find user with valid token
    const user = await models.User.findOne({
      where: {
        email,
        passwordResetToken: token,
        passwordResetExpires: { [require('sequelize').Op.gt]: new Date() },
      },
    });

    if (!user) {
      req.flash('error', 'Invalid or expired reset link.');
      return res.redirect('/app/auth/login');
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // Update password and clear reset token
    await models.User.update(
      {
        passwordHash: hash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
      { where: { email } }
    );

    req.flash('success', 'Password reset successful! You can now login with your new password.');
    res.redirect('/app/auth/login');
  } catch (err) {
    console.error('Reset password error:', err);
    req.flash('error', 'An error occurred. Please try again.');
    res.redirect('/app/auth/login');
  }
});

module.exports = router;
