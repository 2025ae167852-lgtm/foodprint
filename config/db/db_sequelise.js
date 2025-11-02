const { Sequelize } = require('sequelize');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL is not defined in environment variables');
  throw new Error('DATABASE_URL is required');
}

// Determine dialect from DATABASE_URL or DB_DIALECT
let dialect = 'postgres'; // default
if (connectionString.startsWith('mysql://')) {
  dialect = 'mysql';
} else if (process.env.DB_DIALECT) {
  dialect = process.env.DB_DIALECT;
}

const dialectOptions = {};

// Enable SSL for PostgreSQL on Render (requires SSL by default)
// Only disable if explicitly set to 'false'
if (dialect === 'postgres' && process.env.DB_SSL !== 'false') {
  dialectOptions.ssl = {
    require: true,
    rejectUnauthorized: false
  };
}

const sequelize = new Sequelize(connectionString, {
  dialect: dialect,
  protocol: dialect === 'mysql' ? 'mysql' : 'postgres',
  logging: process.env.DB_LOGGING === 'true' ? console.log : false,
  dialectOptions: Object.keys(dialectOptions).length > 0 ? dialectOptions : undefined,
  pool: {
    max: parseInt(process.env.DB_POOL_MAX || '5', 10),
    min: parseInt(process.env.DB_POOL_MIN || '0', 10),
    acquire: parseInt(process.env.DB_POOL_ACQUIRE || '30000', 10),
    idle: parseInt(process.env.DB_POOL_IDLE || '10000', 10),
  },
});

// Authenticate async to avoid blocking module load
(async () => {
  try {
    await sequelize.authenticate();
    console.log(`✅ Database connected successfully (${dialect.toUpperCase()})`);
    
    // Sync database tables if enabled
    const shouldSync = process.env.DB_SYNC !== 'false';
    
    if (shouldSync) {
      try {
        console.log('🔄 Creating database tables...');
        
        // Create user table first (most critical for registration)
        try {
          await sequelize.query(`
            CREATE TABLE IF NOT EXISTS "user" (
              "ID" SERIAL PRIMARY KEY,
              "firstName" VARCHAR(255),
              "middleName" VARCHAR(255),
              "lastName" VARCHAR(255),
              "email" VARCHAR(255),
              "phoneNumber" VARCHAR(255),
              "role" VARCHAR(255),
              "password" VARCHAR(255),
              "passwordHash" VARCHAR(255),
              "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              "registrationChannel" VARCHAR(255),
              "nationalIdPhotoHash" BYTEA,
              "user_identifier_image_url" VARCHAR(255),
              "passwordResetToken" VARCHAR(255),
              "passwordResetExpires" TIMESTAMP
            );
          `);
          console.log('✅ User table created');
        } catch (err) {
          console.log('⚠️ User table might already exist:', err.message);
        }
        
        // Create indexes for user table (non-unique to avoid conflicts with existing duplicates)
        try {
          // Check if indexes already exist before creating
          await sequelize.query(`
            DO $$
            BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'user_email_idx') THEN
                CREATE INDEX "user_email_idx" ON "user" ("email");
              END IF;
              IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'user_phoneNumber_idx') THEN
                CREATE INDEX "user_phoneNumber_idx" ON "user" ("phoneNumber");
              END IF;
            EXCEPTION WHEN duplicate_table THEN
              -- Index might already exist, ignore
            END $$;
          `);
          console.log('✅ User table indexes checked');
        } catch (err) {
          console.log('⚠️ User indexes check completed (may already exist):', err.message);
        }
        
        // Now load and sync all models
        console.log('🔄 Loading models...');
        const initModels = require('../../models/init-models');
        const models = initModels(sequelize);
        console.log('✅ Models loaded');
        
        // Sync other tables (this will create missing tables)
        console.log('🔄 Syncing other tables...');
        try {
          await sequelize.sync({ 
            alter: false, 
            force: false,
            // Disable automatic index creation to avoid conflicts with existing data
            define: {
              indexes: false
            }
          });
          console.log('✅ All database tables ready!');
        } catch (syncError) {
          // Handle sync errors gracefully - indexes might fail if duplicates exist
          if (syncError.name === 'SequelizeUniqueConstraintError' || 
              syncError.name === 'SequelizeDatabaseError' ||
              syncError.message && syncError.message.includes('duplicate') ||
              syncError.message && syncError.message.includes('already exists')) {
            console.warn('⚠️ Some indexes could not be created (may have duplicates or already exist). Tables are ready.');
            console.warn('⚠️ This is normal if the database already has data.');
          } else {
            throw syncError; // Re-throw unexpected errors
          }
        }
      } catch (syncErr) {
        console.error('❌ Database sync error:', syncErr.message);
        console.error('Full sync error:', syncErr);
        console.error('Stack:', syncErr.stack);
      }
    }
  } catch (err) {
    console.error('❌ Unable to connect to the database:', err.message || err);
  }
})();

module.exports = sequelize;
