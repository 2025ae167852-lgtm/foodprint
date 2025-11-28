// server.js
const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const passport = require('passport');
const bodyParser = require('body-parser');
const SequelizeStore = require('connect-session-sequelize')(session.Store);

const sequelize = require('./config/db/db_sequelise');
const initModels = require('./models/init-models');
initModels(sequelize);

const app = express();

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session store
const store = new SequelizeStore({ db: sequelize });
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'foodprint-secret',
    store,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }, // 1 day
  })
);
store.sync();

// Passport + flash
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// Flash messages available in views
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.user = req.user;
  next();
});

// Routers
app.use('/app/auth', require('./routes/auth'));
app.use('/app/harvest', require('./routes/harvest'));
app.use('/app/storage', require('./routes/storage'));
app.use('/app/buyer', require('./routes/buyer'));
app.use('/app/seller', require('./routes/seller'));
app.use('/app/order', require('./routes/order'));
app.use('/app/dashboards', require('./routes/dashboards'));
app.use('/app/qrcode', require('./routes/qrcode'));
app.use('/app/search', require('./routes/search'));
app.use('/app/api/v1', require('./routes/api_v1'));
app.use('/app/email', require('./routes/email'));
app.use('/app/test', require('./routes/test'));
app.use('/app/config', require('./routes/config'));
app.use('/app/blockchain', require('./routes/blockchain'));
app.use('/app/produce', require('./routes/produce'));

// Root route (needed for Railway healthcheck)
app.get('/', (req, res) => {
  res.send('🚀 FoodPrint API is live!');
});

// Error handling
app.use((req, res) => {
  res.status(404).render('404', { title: 'Not Found' });
});

// Start server (Railway requires process.env.PORT)
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 FoodPrint Server is running on port ${PORT} (env=${process.env.NODE_ENV})`);
});
