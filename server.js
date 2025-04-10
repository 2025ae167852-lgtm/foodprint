require('dotenv').config();
console.log('QRCODE ROUTE FILE LOADED');

const express = require('express');
const createError = require('http-errors');
const sslRedirect = require('heroku-ssl-redirect');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const flash = require('express-flash');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const fs = require('fs');
const router = express.Router();

// Force default NODE_ENV
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const sequelise = require('./config/db/db_sequelise');
const db = require('./config/passport/localdb');
const ROLES = require('./utils/roles');
const CUSTOM_ENUMS = require('./utils/enums');

const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Swagger config
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Foodprint API',
    version: '1.0.0',
    description: 'Foodprint API to allow external apps to communicate with Foodprint',
    license: {
      name: 'MIT',
      url: 'https://github.com/FoodPrintLabs/foodprint/blob/master/LICENSE',
    },
    contact: {
      name: 'Foodprint Labs',
      url: 'https://github.com/FoodPrintLabs',
    },
  },
  servers: [{ url: 'http://localhost:3000', description: 'dev' }],
};

const swaggerOptions = {
  swaggerDefinition,
  apis: ['./routes/*.js'],
};

const swaggerSpecs = swaggerJSDoc(swaggerOptions);

const app = express();

// Redirect HTTP to HTTPS in production
if (process.env.NODE_ENV === 'production') {
  app.use(sslRedirect());
  // Fallback HTTPS redirect using x-forwarded-proto
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
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

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(cors());

// Fallback SESSION_SECRET
const sessionSecret = process.env.SESSION_SECRET || 'default_secret_dev';
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1800000 },
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// Flash locals for views
app.use((req, res, next) => {
  res.locals.error = req.flash('error');
  res.locals.success = req.flash('success');
  next();
});

// Swagger docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

// Static files
app.use(express.static(path.join(__dirname, 'src')));
app.use(express.static(path.join(__dirname, 'build')));

// Routes
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
app.use('/', router);

// Passport
const configureStrategy = name =>
  new LocalStrategy(
    {
      usernameField: 'loginUsername',
      passwordField: 'loginPassword',
    },
    (username, password, cb) => {
      db.users.findByUsername(username, (err, user) => {
        if (err) return cb(err);
        if (!user || user.password !== password) {
          return cb(null, false, { message: 'Incorrect credentials.' });
        }
        return cb(null, user);
      });
    }
  );

passport.use('file-local', configureStrategy('file-local'));
passport.use('db-local', configureStrategy('db-local'));

passport.serializeUser((user, cb) => cb(null, user.id));
passport.deserializeUser((id, cb) => {
  db.users.findById(id, (err, user) => cb(err, user));
});

// Home route
router.get(
  '/',
  require('connect-ensure-login').ensureLoggedIn({ redirectTo: '/app/auth/login' }),
  (req, res) => {
    res.render('index', {
      user: req.user,
      page_name: 'home',
      admin_status: [ROLES.Admin, ROLES.Superuser].includes(req.user.role),
    });
  }
);

// 404 handler
app.use((req, res, next) => {
  next(createError(404));
});

// Error handler
app.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error', { user: req.user, page_name: 'error' });
});

// DB + Server
sequelise
  .authenticate()
  .then(() => {
    console.log('Database connected...');
    return sequelise.sync();
  })
  .then(() => {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
  })
  .catch(err => {
    console.error('Error starting server:', err);
  });

module.exports = app;
