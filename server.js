// server.js - Auth removed / open mode
require('dotenv').config();
console.log('✅ SERVER INITIALIZING...');

const express = require('express');
const createError = require('http-errors');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const flash = require('express-flash');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const sequelise = require('./config/db/db_sequelise'); // keep DB intact
// NOTE: auth removed — routes using auth must use the shim (see README below)

const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Swagger config (unchanged)
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Foodprint API',
    version: '1.0.0',
    description: 'Foodprint API to allow external apps to communicate with Foodprint',
  },
  servers: [{ url: 'http://localhost:3000', description: 'dev' }],
};
const swaggerOptions = { swaggerDefinition, apis: ['./routes/*.js'] };
const swaggerSpecs = swaggerJSDoc(swaggerOptions);

const app = express();

// Simple HTTPS redirect for hosts behind proxies (Render sets x-forwarded-proto)
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] === 'http') {
      return res.redirect('https://' + req.headers.host + req.url);
    }
    next();
  });
}

// view engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// logging
const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' });
app.use(
  logger(process.env.NODE_ENV === 'production' ? 'common' : 'dev', {
    skip: (req, res) => process.env.NODE_ENV === 'production' && res.statusCode < 400,
    stream: process.env.NODE_ENV !== 'production' ? accessLogStream : undefined,
  })
);

// parsing
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Flash is harmless if present; keep it for view messages
app.use(flash());

// IMPORTANT: Authentication disabled: add shim to app locals so routes can reference if desired
app.locals.authDisabled = true;
console.warn('⚠ DigitalOcean uploads or Blockchain auth may be disabled. AUTH SYSTEM IS DISABLED — app is OPEN (public).');

// Swagger docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

// Static files
app.use(express.static(path.join(__dirname, 'src')));
app.use(express.static(path.join(__dirname, 'build')));

// Route registration (keep them; they should be updated to use the auth shim)
app.use('/app/config', require('./routes/config'));
app.use('/app/auth', require('./routes/auth')); // recommended: update this file to remove login UI or leave for display only
app.use('/app/harvest', require('./routes/harvest'));
app.use('/app/storage', require('./routes/storage'));
app.use('/app/produce', require('./routes/produce'));
app.use('/app/dashboards', require('./routes/dashboards'));
app.use('/app/buyer', require('./routes/buyer'));
app.use('/app/seller', require('./routes/seller'));
app.use('/app/order', require('./routes/order'));
app.use('/app/email', require('./routes/email'));
app.use('/app', require('./routes/qrcode'));
app.use('/app/api/v1', require('./routes/api_v1'));
app.use('/', require('./routes/blockchain'));
app.use('/', require('./routes/test'));
app.use('/', require('./routes/search'));

// Minimal public home (if routes require ensureLoggedIn, use shim)
app.get('/', (req, res) => {
  res.render('index', { user: null, page_name: 'home', admin_status: false });
});

// 404 handler
app.use((req, res, next) => next(createError(404)));

// error handler
app.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  // fallback safe render in case views expect user
  res.render('error', { user: null, page_name: 'error' });
});

// DB + Server startup
sequelise
  .authenticate()
  .then(() => {
    console.log('✅ Database connection established successfully.');
    return sequelise.sync();
  })
  .then(() => {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`🚀 Server started on port ${PORT}`));
  })
  .catch(err => {
    console.error('❌ Error starting server:', err);
    process.exit(1);
  });

module.exports = app;
