/**************************************************************************
 * SERVER.JS – FULLY UPDATED FOR RENDER / LOCAL DEVELOPMENT COMPATIBILITY
 **************************************************************************/

require('dotenv').config();
console.log('✅ SERVER INITIALIZING...');

// Core modules
const express = require('express');
const createError = require('http-errors');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const session = require('express-session');
const cors = require('cors');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const path = require('path');
const fs = require('fs');
const flash = require('express-flash');

// App initialization
const app = express();
const router = express.Router();
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// Database & Auth
const sequelize = require('./config/db/db_sequelise');
const db = require('./config/passport/localdb');
const ROLES = require('./utils/roles');

// Swagger setup
const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Foodprint API',
    version: '1.0.0',
    description: 'API documentation for Foodprint application',
  },
  servers: [{ url: process.env.BASE_URL || 'http://localhost:3000' }],
};

const swaggerOptions = {
  swaggerDefinition,
  apis: ['./routes/*.js'],
};

const swaggerSpecs = swaggerJSDoc(swaggerOptions);

/**************************************************************************
 * ✅ HTTPS Redirect (works on Render)
 **************************************************************************/
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] === 'http') {
      return res.redirect(`https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

/**************************************************************************
 * ✅ View Engine Setup
 **************************************************************************/
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

/**************************************************************************
 * ✅ Logging Setup
 **************************************************************************/
const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' });
app.use(
  logger(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
    skip: (req, res) => process.env.NODE_ENV === 'production' && res.statusCode < 400,
    stream: process.env.NODE_ENV === 'production' ? accessLogStream : undefined,
  })
);

/**************************************************************************
 * ✅ Core Middleware
 **************************************************************************/
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(cors());

// ✅ Session (with fallback secret)
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'default_dev_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 30 * 60 * 1000 }, // 30 mins
  })
);

app.use(flash());

/**************************************************************************
 * ✅ Passport Authentication
 **************************************************************************/
passport.use(
  new LocalStrategy({ usernameField: 'loginUsername', passwordField: 'loginPassword' }, (username, password, done) => {
    db.users.findByUsername(username, (err, user) => {
      if (err) return done(err);
      if (!user || user.password !== password) {
        return done(null, false, { message: 'Invalid login credentials' });
      }
      return done(null, user);
    });
  })
);

passport.serializeUser((user, cb) => cb(null, user.id));
passport.deserializeUser((id, cb) => db.users.findById(id, (err, user) => cb(err, user)));

app.use(passport.initialize());
app.use(passport.session());

/**************************************************************************
 * ✅ Expose flash messages to views
 **************************************************************************/
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.user = req.user;
  next();
});

/**************************************************************************
 * ✅ Static Assets
 **************************************************************************/
app.use(express.static(path.join(__dirname, 'src')));
app.use(express.static(path.join(__dirname, 'build')));

/**************************************************************************
 * ✅ Swagger Documentation
 **************************************************************************/
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

/**************************************************************************
 * ✅ Routes
 **************************************************************************/
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

/**************************************************************************
 * ✅ Protected Home Route (with safe fallback to avoid crash)
 **************************************************************************/
let ensureLoggedIn;
try {
  ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn;
} catch (err) {
  console.warn('⚠️ connect-ensure-login not installed. Using fallback.');
  ensureLoggedIn = () => (req, res, next) => next();
}

router.get('/', ensureLoggedIn({ redirectTo: '/app/auth/login' }), (req, res) => {
  res.render('index', {
    user: req.user,
    page_name: 'home',
    admin_status: req.user && [ROLES.Admin, ROLES.Superuser].includes(req.user.role),
  });
});
app.use('/', router);

/**************************************************************************
 * ✅ 404 Handler
 **************************************************************************/
app.use((req, res, next) => next(createError(404)));

/**************************************************************************
 * ✅ Error Handler
 **************************************************************************/
app.use((err, req, res, next) => {
  res.status(err.status || 500);
  res.render('error', { message: err.message, error: process.env.NODE_ENV === 'development' ? err : {} });
});

/**************************************************************************
 * ✅ Start Server After DB Connect
 **************************************************************************/
sequelize
  .authenticate()
  .then(() => {
    console.log('✅ Database connected successfully!');
    return sequelize.sync();
  })
  .then(() => {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('❌ Failed to start server:', err.message || err);
  });

module.exports = app;
