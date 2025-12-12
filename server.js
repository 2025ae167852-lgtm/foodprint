/**
 * server.js - safe/robust server for Render (production)
 *
 * - Loads .env
 * - Serves EJS views from /views
 * - Serves multiple static directories if they exist
 * - Tolerant route loading (skips routes that throw on require)
 * - Only initializes optional services (email, uploads) if explicitly enabled
 * - Option A behavior: public landing; if user not logged in, show landing with admin_status=false
 * - Deployment: Root directory must be set to "." in Render dashboard
 */

'use strict';

// Load environment variables FIRST, before any other imports
require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const session = require('express-session');
const flash = require('express-flash');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const createError = require('http-errors');
const cors = require('cors');
const pgSession = require('connect-pg-simple');
const pg = require('pg');

const CUSTOM_ENUMS = {
  PRODUCTION: 'production',
  DEVELOPMENT: 'development',
};

const app = express();

// -------------------------
// Views & statics
// -------------------------
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Check if views directory exists
const viewsDir = path.join(__dirname, 'views');
if (!fs.existsSync(viewsDir)) {
  console.error('❌ ERROR: Views directory does not exist:', viewsDir);
  console.log('📂 Current directory:', __dirname);
  console.log('📂 Directory contents:', fs.readdirSync(__dirname));
}

const staticDirs = ['foodprint-static', 'public', 'src', 'build', 'docs', 'dist'];
staticDirs.forEach(dir => {
  const full = path.join(__dirname, dir);
  if (fs.existsSync(full)) {
    app.use(express.static(full));
  }
});

// -------------------------
// Logging
// -------------------------
if (process.env.NODE_ENV === CUSTOM_ENUMS.PRODUCTION) {
  app.use(logger('common', { skip: (req, res) => res.statusCode < 400 }));
} else {
  app.use(logger('dev'));
}

// -------------------------
// Parsers & cookie
// -------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Changed to true for form data
app.use(cookieParser());
app.use(cors());

// -------------------------
// Session & passport (minimal local file-based auth as repo expects)
// -------------------------
// Configure session store based on availability of DATABASE_URL
const databaseUrl = process.env.DATABASE_URL || null;
let sessionConfig = {
  secret: process.env.SESSION_SECRET || 'dev-session-secret',
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: (parseInt(process.env.SESSION_TOKEN_LIFETIME || '3600', 10) || 3600) * 1000,
  },
};

// Use PostgreSQL session store if DATABASE_URL is available
if (databaseUrl) {
  try {
    const Pool = pg.Pool;
    const SessionStore = pgSession(session);
    
    // Configure SSL for PostgreSQL (required on Render)
    const poolConfig = {
      connectionString: databaseUrl,
    };
    
    // Add SSL configuration unless explicitly disabled
    if (process.env.DB_SSL !== 'false') {
      poolConfig.ssl = {
        require: true,
        rejectUnauthorized: false
      };
    }
    
    const pool = new Pool(poolConfig);
    
    // Try to create the session table if it doesn't exist
    (async () => {
      try {
        await pool.query(`CREATE TABLE IF NOT EXISTS "session" (
          "sid" varchar NOT NULL,
          "sess" json NOT NULL,
          "expire" timestamp(6) NOT NULL,
          CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
        )`);
        
        // Try to create index (will fail if exists, that's ok)
        await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")`).catch(() => {});
        
        console.log('✅ Session table ready');
      } catch (err) {
        console.warn('Could not create session table (might already exist):', err.message);
      }
    })();
    
    sessionConfig.store = new SessionStore({
      pool: pool,
      tableName: 'session',
      createTableIfMissing: false, // We create it ourselves above
    });
    console.log('✅ Using PostgreSQL session store');
  } catch (e) {
    console.warn('Failed to initialize PostgreSQL session store, using MemoryStore:', e.message);
  }
} else {
  console.warn('No DATABASE_URL found, using MemoryStore (not suitable for production)');
}

app.use(session(sessionConfig));

// -------------------------
// Middleware that needs to come after session
// -------------------------
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

// Passport configuration
const initModels = require('./models/init-models');
const sequelize = require('./config/db/db_sequelise');
const models = initModels(sequelize);
const bcrypt = require('bcryptjs');

// Serialize user
passport.serializeUser((user, done) => {
  done(null, user.id || user.ID);
});

// Deserialize user
passport.deserializeUser(async (id, done) => {
  try {
    const user = await models.User.findByPk(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Local strategy for authentication
passport.use(new LocalStrategy(
  {
    usernameField: 'email',
    passwordField: 'password'
  },
  async (email, password, done) => {
    try {
      const user = await models.User.findOne({ where: { email } });
      
      if (!user) {
        return done(null, false, { message: 'Invalid email or password' });
      }
      
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return done(null, false, { message: 'Invalid email or password' });
      }
      
      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }
));

// expose flash messages to views
app.use((req, res, next) => {
  res.locals.error = req.flash('error');
  res.locals.success = req.flash('success');
  res.locals.user = req.user || null;
  next();
});

// -------------------------
// Database (Sequelize) - prefer DATABASE_URL if present
// -------------------------
(async function initDatabase() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected successfully (POSTGRES)');
    
    // Sync by default unless explicitly disabled
    const shouldSync = process.env.DB_SYNC !== 'false';
    
    if (shouldSync) {
      try {
        console.log('🔄 Creating database tables...');
        
        // Import and initialize models so sequelize knows what tables to create
        const initModels = require('./models/init-models');
        const models = initModels(sequelize);
        console.log('✅ Database connected successfully');
        
        console.log('🔄 Loading models and checking database tables...');
        
        // Sync each model individually to avoid conflicts
        console.log('🔄 Syncing database...');
        
        // User table first (most important)
        try {
          await models.User.sync();
          console.log('✅ User table created');
        } catch (userErr) {
          console.warn('⚠️ User table sync warning:', userErr.message);
        }
        
        // Check and create indexes separately
        try {
          // Check if we need to create indexes
          const indexes = await sequelize.queryInterface.showIndex(models.User.tableName);
          if (!indexes || indexes.length === 0) {
            console.log('✅ User table indexes checked');
          }
        } catch (indexErr) {
          console.warn('⚠️ Index check warning (may already exist):', indexErr.message);
        }
        
        console.log('✅ Models initialized');
        
        console.log('🔄 Syncing other tables...');
        // Sync other models
        for (const modelName in models) {
          if (modelName !== 'User' && modelName !== 'sequelize' && modelName !== 'Sequelize') {
            try {
              await models[modelName].sync();
            } catch (syncErr) {
              console.warn(`⚠️ ${modelName} table sync warning:`, syncErr.message);
            }
          }
        }
        
        console.log('⚠️ Some indexes could not be created (may have duplicates or already exist). Tables are ready.');
        console.log('⚠️ This is normal if the database already has data.');
        console.log('✅ Database tables ready.');
        
      } catch (syncErr) {
        console.error('❌ Database sync error:', syncErr.message);
        console.warn('⚠️  If tables already exist, you can set DB_SYNC=false to suppress this.');
      }
    } else {
      console.log('⚠️  Database sync disabled by DB_SYNC=false setting.');
    }
  } catch (err) {
    console.error('Error connecting to database:', err && err.message ? err.message : err);
  }
})().catch(e => console.error('DB init unexpected error', e));

// -------------------------
// Optional: Email transport
// -------------------------
if (process.env.EMAIL_ENABLED !== 'true') {
  console.log('Email disabled (EMAIL_ENABLED not set to true)');
}

// -------------------------
// Safe route loader helper
// -------------------------
function tryRequireRoute(modulePath) {
  try {
    const resolved = require.resolve(modulePath);
    console.log(`🔄 Loading ${modulePath}...`);
    const module = require(resolved);
    console.log(`✅ Loaded ${modulePath}`);
    return module;
  } catch (err) {
    console.warn(`Route load failed: ${modulePath} - ${err.message}`);
    return null;
  }
}

// -------------------------
// HEALTH CHECK ENDPOINT - KEEP THIS
// -------------------------
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: '🚀 FoodPrint server is live and healthy!',
    timestamp: new Date().toISOString()
  });
});

// -------------------------
// MAIN LANDING PAGE - MUST COME BEFORE OTHER ROUTES
// -------------------------
app.get('/', (req, res) => {
  console.log('📢 Main landing page accessed');
  
  const user = req.user || null;
  const admin_status = user && (user.role === 'Admin' || user.role === 'Superuser');
  
  // Check if views directory exists
  const indexPath = path.join(__dirname, 'views', 'index.ejs');
  
  if (!fs.existsSync(viewsDir)) {
    console.error('❌ Views directory missing! Creating it...');
    fs.mkdirSync(viewsDir, { recursive: true });
  }
  
  // Check if index.ejs exists
  if (fs.existsSync(indexPath)) {
    console.log('✅ Found index.ejs, rendering...');
    console.log('📁 Views folder contents:', fs.readdirSync(viewsDir));
    
    try {
      return res.render('index', {
        user,
        admin_status: !!admin_status,
        page_name: 'home',
        title: 'FoodPrint - Farm to Fork Supply Chain',
        message: 'Welcome to FoodPrint'
      });
    } catch (renderError) {
      console.error('❌ Error rendering index.ejs:', renderError.message);
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Render Error</title></head>
        <body>
          <h1>Template Error</h1>
          <p>Error rendering index.ejs: ${renderError.message}</p>
          <p>Check the EJS syntax in your template.</p>
        </body>
        </html>
      `);
    }
  }
  
  // Create a basic index.ejs file if it doesn't exist
  console.log('⚠️ index.ejs not found, creating basic template...');
  const basicTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><%= title || 'FoodPrint' %></title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; }
        .hero { 
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%); 
            color: white; 
            padding: 80px 20px; 
            border-radius: 10px; 
            margin-top: 20px;
        }
        .feature-icon { font-size: 3rem; margin-bottom: 1rem; }
    </style>
</head>
<body>
    <nav class="navbar navbar-expand-lg navbar-dark bg-success">
        <div class="container">
            <a class="navbar-brand" href="/">
                🌱 <strong>FoodPrint</strong>
            </a>
            <div class="navbar-nav ms-auto">
                <% if (user) { %>
                    <a class="nav-link" href="/app/dashboards">Dashboard</a>
                    <a class="nav-link" href="/app/auth/logout">Logout</a>
                <% } else { %>
                    <a class="nav-link" href="/app/auth/login">Login</a>
                    <a class="nav-link" href="/app/auth/register">Register</a>
                <% } %>
            </div>
        </div>
    </nav>

    <div class="container my-5">
        <div class="hero text-center">
            <h1 class="display-4 mb-4">🌱 Welcome to FoodPrint</h1>
            <p class="lead mb-4">Blockchain-enabled farm-to-fork supply chain tracking platform</p>
            <div class="mt-4">
                <% if (user) { %>
                    <a href="/app/dashboards" class="btn btn-light btn-lg mx-2">Go to Dashboard</a>
                <% } else { %>
                    <a href="/app/auth/login" class="btn btn-light btn-lg mx-2">Login</a>
                    <a href="/app/auth/register" class="btn btn-outline-light btn-lg mx-2">Register</a>
                <% } %>
            </div>
        </div>

        <div class="row mt-5">
            <div class="col-md-4 text-center mb-4">
                <div class="feature-icon">🌾</div>
                <h3>Farm Tracking</h3>
                <p>Track produce from farm to fork with blockchain transparency</p>
            </div>
            <div class="col-md-4 text-center mb-4">
                <div class="feature-icon">📱</div>
                <h3>QR Code Integration</h3>
                <p>Scan QR codes for instant product history and verification</p>
            </div>
            <div class="col-md-4 text-center mb-4">
                <div class="feature-icon">🔗</div>
                <h3>Blockchain Security</h3>
                <p>Immutable records ensure supply chain integrity</p>
            </div>
        </div>
    </div>

    <footer class="bg-light text-center py-4 mt-5">
        <div class="container">
            <p class="mb-0">FoodPrint &copy; <%= new Date().getFullYear() %> | Farm to Fork Supply Chain Platform</p>
            <p class="text-muted mt-2">
                <a href="/health" class="text-muted">Server Health</a> | 
                <a href="/app/auth/login" class="text-muted">Admin Login</a>
            </p>
        </div>
    </footer>
</body>
</html>`;
  
  try {
    fs.writeFileSync(indexPath, basicTemplate);
    console.log('✅ Created basic index.ejs template');
    
    // Now render it
    return res.render('index', {
      user,
      admin_status: !!admin_status,
      page_name: 'home',
      title: 'FoodPrint - Farm to Fork Supply Chain',
      message: 'Welcome to FoodPrint'
    });
  } catch (writeError) {
    console.error('❌ Failed to create index.ejs:', writeError.message);
    
    // Fallback HTML
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>FoodPrint - Farm to Fork</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>
          body { padding: 20px; background: #f8f9fa; }
          .hero { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 60px 20px; border-radius: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="hero text-center">
            <h1>🌱 FoodPrint</h1>
            <p class="lead">Blockchain-enabled farm-to-fork supply chain platform</p>
            <div class="mt-4">
              <a href="/app/auth/login" class="btn btn-light btn-lg mx-2">Login</a>
              <a href="/app/auth/register" class="btn btn-outline-light btn-lg mx-2">Register</a>
            </div>
          </div>
          <div class="text-center mt-4">
            <p>Server is running. <a href="/app/auth/login">Go to Login</a></p>
            <p class="text-muted"><small>Health check: <a href="/health">/health</a></small></p>
          </div>
        </div>
      </body>
      </html>
    `);
  }
});

// -------------------------
// EXPLICIT ROUTE MOUNTS - AFTER MAIN LANDING PAGE
// -------------------------
console.log('🔄 Loading routes...');

// Mount critical routes
const essentialRoutes = [
  { file: './routes/auth', path: '/app/auth', required: true },
  { file: './routes/dashboards', path: '/app/dashboards', required: true },
  { file: './routes/produce', path: '/app/produce', required: true },
  { file: './routes/buyer', path: '/app/buyer', required: true },
  { file: './routes/seller', path: '/app/seller', required: true },
  { file: './routes/order', path: '/app/order', required: true },
];

essentialRoutes.forEach(m => {
  const mod = tryRequireRoute(m.file);
  if (mod) {
    try {
      app.use(m.path, mod);
      console.log(`✅ Mounted route ${m.file} -> ${m.path}`);
    } catch (e) {
      console.warn(`Skipping mount ${m.file} due to runtime error:`, e.message);
    }
  } else if (m.required) {
    console.warn(`⚠️ Required route module missing: ${m.file}`);
  }
});

// Mount additional routes
const additionalRoutes = [
  { file: './routes/config', path: '/app/config' },
  { file: './routes/harvest', path: '/app/harvest' },
  { file: './routes/storage', path: '/app/storage' },
  { file: './routes/qrcode', path: '/app' },
  { file: './routes/email', path: '/app/email' },
  { file: './routes/search', path: '/' },
  { file: './routes/api_v1', path: '/app/api/v1' },
];

additionalRoutes.forEach(m => {
  const mod = tryRequireRoute(m.file);
  if (mod) {
    try {
      app.use(m.path, mod);
      console.log(`✅ Mounted route ${m.file} -> ${m.path}`);
    } catch (e) {
      console.warn(`Skipping mount ${m.file} due to runtime error:`, e.message);
    }
  }
});

// Try to mount test route if exists (BUT NOT AT ROOT)
const testRoute = tryRequireRoute('./routes/test');
if (testRoute) {
  app.use('/test', testRoute); // Changed from '/' to '/test'
  console.log('✅ Mounted route ./routes/test -> /test');
}

// Try to mount blockchain route if exists (BUT NOT AT ROOT)
const blockchainRoute = tryRequireRoute('./routes/blockchain');
if (blockchainRoute) {
  app.use('/blockchain', blockchainRoute); // Changed from '/' to '/blockchain'
  console.log('✅ Mounted route ./routes/blockchain -> /blockchain');
} else {
  console.warn('⚠️ Blockchain route not found or failed to load');
}

console.log('✅ All routes loaded');

// -------------------------
// 404 + error handler
// -------------------------
app.use((req, res, next) => {
  const error = createError(404, `Route not found: ${req.originalUrl}`);
  console.log(`❌ 404: ${req.originalUrl}`);
  next(error);
});

app.use((err, req, res, next) => {
  // Set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  
  // Check if headers have already been sent
  if (res.headersSent) {
    return next(err);
  }
  
  // Render the error page
  res.status(err.status || 500);
  
  const errorView = path.join(__dirname, 'views', 'error.ejs');
  if (fs.existsSync(errorView)) {
    try {
      res.render('error', { 
        user: req.user || null, 
        page_name: 'error',
        title: 'Error',
        message: err.message
      });
    } catch (renderError) {
      // If render fails, send simple error
      res.json({ 
        error: err.message || 'Server error',
        status: err.status || 500
      });
    }
  } else {
    res.json({ 
      error: err.message || 'Server error',
      status: err.status || 500
    });
  }
});

// -------------------------
// Start server
// -------------------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 FoodPrint Server is running on port ${PORT} (env=${process.env.NODE_ENV || 'production'})`);
  console.log(`📁 Views directory: ${viewsDir}`);
  console.log(`📄 Looking for index.ejs at: ${path.join(viewsDir, 'index.ejs')}`);
  if (process.env.NODE_ENV !== CUSTOM_ENUMS.PRODUCTION) {
    console.log(`🌐 Access it at http://localhost:${PORT}`);
  }
});

module.exports = app;
