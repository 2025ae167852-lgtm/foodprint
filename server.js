// server.js - CLEANED VERSION WITHOUT BLOCKCHAIN
// -----------------------------------------------

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const passport = require('passport');
require('dotenv').config();

const sequelize = require('./config/db/db_sequelise');
const initModels = require('./models/init-models');
const models = initModels(sequelize);

// ROUTES
const authRoutes = require('./routes/auth');
const qrcodeRoutes = require('./routes/qrcode');
const blockchainRoutes = require('./routes/blockchain'); // now stubbed

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sessions (memory store - warning for production)
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'local_dev_secret',
    resave: false,
    saveUninitialized: true,
  })
);

// Initialize Passport Authentication
require('./config/passport')(passport);
app.use(passport.initialize());
app.use(passport.session());

// ✅ DATABASE CONNECTION CHECK
(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Successfully connected to the database.');
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error.message);
  }
})();

// ✅ ROUTES
app.use('/api/auth', authRoutes);
app.use('/api/qrcode', qrcodeRoutes);

// 🔴 Blockchain routes disabled
app.use('/api/blockchain', blockchainRoutes);

// ✅ ROOT ENDPOINT
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'FoodPrint server is running (Blockchain disabled mode)'
  });
});

// ✅ START SERVER
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log('⚠ Blockchain functionality is completely disabled.');
});

module.exports = app;

