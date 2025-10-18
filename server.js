// server.js
require('dotenv').config();

// ---- Monkey-patch require to stub connect-ensure-login BEFORE any route modules are loaded ----
// This makes `require('connect-ensure-login').ensureLoggedIn(...)` a no-op middleware.
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (request) {
  if (request === 'connect-ensure-login') {
    return {
      ensureLoggedIn: function (opts) {
        return function (req, res, next) {
          // intentionally allow every request through (open system)
          next();
        };
      },
    };
  }
  return originalRequire.apply(this, arguments);
};
// ---- end monkey-patch ----

console.log('✅ SERVER INITIALIZING...');

const express = require('express');
const createError = require('http-errors');
// NOTE: we are disabling heroku-ssl-redirect usage because we rely on X-Forwarded-Proto redirect below
// const sslRedirect = require('heroku-ssl-redirect');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const flash = require('express-flash');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// keep passport required (some routes may still require it), but we will noop authenticate later
const passport = require('passport');

// Force default NODE_ENV
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const sequelise = require('./config/db/db_sequelise');
const ROLES = require('./utils/roles');

// swagger
const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Foodprint API',
    version: '1.0.0',
    description: 'Foodprint API to allow external apps to communicate with Foodprint',
  },
  servers: [{ url: 'http://localhost:3000', description: 'dev' }],
};

const swaggerOptions = {
  swaggerDefinition,
  apis: ['./routes/*.js'],
};

const swaggerSpecs = swaggerJSDoc(swaggerOptions);

const app = express();

// If running in production behind a proxy (Render), force HTTPS via x-forwarded-proto header check
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', true);
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] === 'http') {
      return res.redirect('https://' + req.headers.host + req.url);
    }
    next();
  });
}

// View engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Logging
const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' });
app.use(
  logger(process.env.NODE_ENV === 'production' ? 'common' : 'dev', {
    skip: (req, res) => process.env.NODE_ENV === 'production' && res.statusCode < 400,
    stream: process.env.NODE_ENV !== 'production' ? accessLogStream : undefined,
  })
);

// Parsing + static
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(cors());

// NOTE: We keep session middleware but it's harmless; you may remove it if you want no sessions at all.
const sessionSecret = process.env.SESSION_SECRET || 'default_secret_dev';
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1800000 },
  })
);

// Passport: make authenticate return a no-op middleware so existing code calling passport.authenticate(...) won't crash.
passport.initialize();
passport.session && passport.session(); // no-op if not used

// monkey patch passport.authenticate to bypass auth checks
if (typeof passport.authenticate === 'function') {
  const originalAuthenticate = passport.authenticate.bind(passport);
  passport.authenticate = function () {
    // return middleware that sets req.user if desired and moves on
    return function (req, res, next) {
      // ensure req.user exists for downstream code/templates
      if (!req.user) {
        req.user = {
          id: 0,
          email: 'public@foodprint.local',
          role: ROLES ? ROLES.Public || 'Public' : 'Public',
        };
      }
      next();
    };
  };
} else {
  // fallback noop
  passport.authenticate = function () {
    return function (req, res, next) {
      if (!req.user) {
        req.user = {
          id: 0,
          email: 'public@foodprint.local',
          role: ROLES ? ROLES.Public || 'Public' : 'Public',
        };
      }
      next();
    };
  };
}

// Provide a simple global middleware that injects default req.user for all requests
app.use((req, res, next) => {
  if (!req.user) {
    req.user = {
      id: 0,
      email: 'public@foodprint.local',
      role: ROLES ? ROLES.Public || 'Public' : 'Public',
    };
  }
  // make flash and locals friendly for views
  res.locals.user = req.user;
  res.locals.error = req.flash ? req.flash('error') : [];
  res.locals.success = req.flash ? req.flash('success') : [];
  next();
});

app.use(flash());

// Swagger docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

// Static file folders (adjust to your project structure)
app.use(express.static(path.join(__dirname, 'src')));
app.use(express.static(path.join(__dirname, 'build')));

// Routes (these route modules will see connect-ensure-login as a no-op due to the require monkey patch)
app.use('/app/config', require('./routes/config'));
app.use('/app/auth', require('./routes/auth'));
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

// Home route (no auth required now)
app.get('/', (req, res) => {
  res.render('index', {
    user: req.user,
    page_name: 'home',
    admin_status: [ROLES && ROLES.Admin, ROLES && ROLES.Superuser].includes(req.user.role),
  });
});

// 404 handler
app.use((req, res, next) => {
  next(createError(404));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  try {
    res.render('error', { user: req.user, page_name: 'error' });
  } catch (e) {
    // fallback JSON if rendering fails
    res.json({ error: err.message });
  }
});

// DB + Server
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
  });

module.exports = app;
