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
const { Op } = require('sequelize');

// Twilio (optional, only if EMAIL_ENABLED or SMS needed)
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
let tw_client;
if (accountSid && authToken) {
  tw_client = require('twilio')(accountSid, authToken);
}

/* Helper function to validate request body */
const validateRequestBody = (req, requiredFields = []) => {
  if (!req.body || typeof req.body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }
  
  for (const field of requiredFields) {
    if (!req.body[field]) {
      return { valid: false, error: `${field} is required` };
    }
  }
  
  return { valid: true };
};

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
    // Validate request body
    const validation = validateRequestBody(req, ['registerEmail', 'registerPassword']);
    if (!validation.valid) {
      req.flash('error', validation.error);
      return res.redirect('/app/auth/login');
    }

    const { registerEmail, registerPassword } = req.body;

    // Find user
    const user = await models.User.findOne({ where: { email: registerEmail } });
    if (!user) {
      req.flash('error', 'Invalid email or password');
      return res.redirect('/app/auth/login');
    }

    // Check if password is set
    if (!user.passwordHash) {
      req.flash('error', 'Password not set. Please use forgot password or contact admin.');
      return res.redirect('/app/auth/login');
    }

    // Verify password
    const isMatch = await bcrypt.compare(registerPassword, user.passwordHash);
    if (!isMatch) {
      req.flash('error', 'Invalid email or password');
      return res.redirect('/app/auth/login');
    }

    // Login user
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
    req.flash('error', 'Login failed: ' + (err.message || 'Server error'));
    res.redirect('/app/auth/login');
  }
});

/* Logout */
router.get('/logout', (req, res, next) => {
  req.logout(err => {
    if (err) {
      console.error('Logout error:', err);
      return next(err);
    }
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

/* Register User - FIXED PHONE NUMBER FIELD */
router.post('/register', async (req, res) => {
  console.log('=== REGISTRATION ATTEMPT ===');
  console.log('Request body:', req.body);
  
  try {
    // Validate request body exists
    if (!req.body || typeof req.body !== 'object') {
      req.flash('error', 'Registration data is required');
      return res.redirect('/app/auth/register');
    }

    // Extract fields using the EXACT names from your form
    const {
      registerName,
      registerSurname,
      registerEmail,
      registerConfirmEmail,
      registerPassword,
      registerConfirmPassword,
      registerUserType,
      registerOrgName,
      registerPhone
    } = req.body || {};

    console.log('Extracted fields:', {
      registerName,
      registerSurname,
      registerEmail,
      registerConfirmEmail,
      registerUserType,
      registerOrgName,
      registerPhone
    });

    // Validate required fields
    if (!registerEmail || !registerConfirmEmail) {
      console.log('Missing email fields');
      req.flash('error', 'Email and confirmation are required.');
      return res.redirect('/app/auth/register');
    }
    
    if (!registerPassword || !registerConfirmPassword) {
      console.log('Missing password fields');
      req.flash('error', 'Password and confirmation are required.');
      return res.redirect('/app/auth/register');
    }

    // Validate email format
    if (typeof registerEmail !== 'string' || registerEmail.length < 3 || !registerEmail.includes('@')) {
      req.flash('error', 'Please enter a valid email address.');
      return res.redirect('/app/auth/register');
    }

    // Check email match
    if (registerEmail !== registerConfirmEmail) {
      console.log('Emails do not match:', registerEmail, 'vs', registerConfirmEmail);
      req.flash('error', 'Email addresses do not match.');
      return res.redirect('/app/auth/register');
    }

    // Check password match
    if (registerPassword !== registerConfirmPassword) {
      console.log('Passwords do not match');
      req.flash('error', 'Passwords do not match.');
      return res.redirect('/app/auth/register');
    }

    // Validate password length
    if (typeof registerPassword !== 'string' || registerPassword.length < 6) {
      req.flash('error', 'Password must be at least 6 characters long.');
      return res.redirect('/app/auth/register');
    }

    // Check if user already exists
    const existingUser = await models.User.findOne({ where: { email: registerEmail.trim() } });
    if (existingUser) {
      console.log('Email already exists:', registerEmail);
      req.flash('error', 'Email already registered.');
      return res.redirect('/app/auth/register');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(registerPassword, salt);

    // Generate phone number if not provided (using phoneNumber field name)
    let phoneNumber = registerPhone && typeof registerPhone === 'string' && registerPhone.trim() 
      ? registerPhone.trim()
      : `+254${Math.floor(100000000 + Math.random() * 900000000)}`;
    
    // Ensure phoneNumber is not empty
    if (!phoneNumber || phoneNumber.trim() === '') {
      phoneNumber = `+254${Math.floor(100000000 + Math.random() * 900000000)}`;
    }

    // Create new user with CORRECT field names for your model
    await models.User.create({
      firstName: registerName && typeof registerName === 'string' ? registerName.trim() : '',
      lastName: registerSurname && typeof registerSurname === 'string' ? registerSurname.trim() : '',
      email: registerEmail.trim().toLowerCase(),
      phoneNumber: phoneNumber, // Use phoneNumber (not phone)
      organization: registerOrgName && typeof registerOrgName === 'string' ? registerOrgName.trim() : null,
      passwordHash: hash,
      role: registerUserType && Object.values(ROLES).includes(registerUserType) ? registerUserType : ROLES.User,
      registrationChannel: 'web',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log('✅ User created successfully');
    req.flash('success', 'Registration successful! You can now login.');
    res.redirect('/app/auth/register/message');
  } catch (err) {
    console.error('Registration error:', err);
    console.error('Error details:', {
      message: err.message,
      name: err.name,
      errors: err.errors
    });
    req.flash('error', 'Registration failed: ' + (err.message || 'Please try again'));
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
    // Use the correct field name from your form
    const emailField = req.body.registerEmail || req.body.email;
    const email = emailField ? emailField.trim() : '';

    // Always show success message for security (don't reveal if email exists)
    if (!email) {
      req.flash('success', 'If an account exists, a reset link has been sent.');
      return res.redirect('/app/auth/login');
    }

    const user = await models.User.findOne({ where: { email } });

    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + 3600000); // 1 hour

      await models.User.update(
        { 
          passwordResetToken: resetToken, 
          passwordResetExpires: resetExpires,
          updatedAt: new Date()
        },
        { where: { email } }
      );

      // TODO: Send email/SMS here using configured provider
      console.log(`Reset link: /app/auth/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`);
    }

    req.flash('success', 'If an account exists, a reset link has been sent.');
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
    const { token, email } = req.query || {};

    if (!token || !email || typeof token !== 'string' || typeof email !== 'string') {
      req.flash('error', 'Invalid reset link.');
      return res.redirect('/app/auth/login');
    }

    const user = await models.User.findOne({
      where: {
        email: email.trim(),
        passwordResetToken: token.trim(),
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
      token: token.trim(),
      email: email.trim(),
    });
  } catch (err) {
    console.error('Reset password error:', err);
    req.flash('error', 'An error occurred. Please try again.');
    res.redirect('/app/auth/login');
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, email, password, confirmPassword } = req.body || {};

    // Validate input
    if (!token || !email || typeof token !== 'string' || typeof email !== 'string') {
      req.flash('error', 'Invalid reset request.');
      return res.redirect('/app/auth/login');
    }

    if (!password || !confirmPassword) {
      req.flash('error', 'Password and confirmation are required.');
      return res.redirect(`/app/auth/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`);
    }

    // Validate password
    if (typeof password !== 'string' || password.length < 6) {
      req.flash('error', 'Password must be at least 6 characters long.');
      return res.redirect(`/app/auth/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`);
    }

    if (password !== confirmPassword) {
      req.flash('error', 'Passwords do not match.');
      return res.redirect(`/app/auth/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`);
    }

    // Find user with valid token
    const user = await models.User.findOne({
      where: {
        email: email.trim(),
        passwordResetToken: token.trim(),
        passwordResetExpires: { [Op.gt]: new Date() },
      },
    });

    if (!user) {
      req.flash('error', 'Invalid or expired reset link.');
      return res.redirect('/app/auth/login');
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // Update user
    await models.User.update(
      { 
        passwordHash: hash, 
        passwordResetToken: null, 
        passwordResetExpires: null,
        updatedAt: new Date()
      },
      { where: { email: email.trim() } }
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
