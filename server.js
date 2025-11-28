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

// View engine setup (EJS assumed)
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
const authRoutes = require('./routes/auth');
const harvestRoutes = require('./routes/harvest');
const storageRoutes = require('./routes/storage');
const buyerRoutes = require('./routes/buyer');
const sellerRoutes = require('./routes/seller');
const orderRoutes = require('./routes/order');
const dashboardsRoutes = require('./routes/dashboards');
const qrcodeRoutes = require('./routes/qrcode');
const searchRoutes = require('./routes/search');
const apiV1Routes = require('./routes/api_v1');
const emailRoutes = require('./routes/email');
const testRoutes = require('./routes/test');
const configRoutes = require('./routes/config');
const blockchainRoutes = require('./routes/blockchain');
const produceRoutes = require('./routes/produce');

// Mount routes
app.use('/app/auth', authRoutes);
app.use('/app/harvest', harvestRoutes);
app.use('/app/storage', storageRoutes);
app.use('/app/buyer', buyerRoutes);
app.use('/app/seller', sellerRoutes);
app.use('/app/order', orderRoutes);
app.use('/app/dashboards', dashboardsRoutes);
app.use('/app/qrcode', qrcodeRoutes);
app.use('/app/search', searchRoutes);
app.use('/app/api/v1', apiV1Routes);
app.use('/app/email', emailRoutes);
app.use('/app/test', testRoutes);
app.use('/app/config', configRoutes);
app.use('/app/blockchain', blockchainRoutes);
app.use('/app/produce', produceRoutes);

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
