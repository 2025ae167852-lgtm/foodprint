#!/usr/bin/env node

/**
 * Database synchronization script
 * Creates all tables if they don't exist
 * Run: node scripts/sync-database.js
 */

const Sequelize = require('sequelize');
const initModels = require('../models/init-models');

// Get connection string
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL is not defined in environment variables');
  process.exit(1);
}

// Configure SSL for PostgreSQL
const dialectOptions = {};
if (process.env.DB_SSL !== 'false') {
  dialectOptions.ssl = {
    require: true,
    rejectUnauthorized: false
  };
}

// Create Sequelize instance
const sequelize = new Sequelize(connectionString, {
  dialect: 'postgres',
  logging: console.log,
  dialectOptions: Object.keys(dialectOptions).length > 0 ? dialectOptions : undefined,
});

// Initialize models and sync
async function syncDatabase() {
  try {
    console.log('🔌 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected successfully');
    
    console.log('📊 Initializing models...');
    const models = initModels(sequelize);
    console.log('✅ Models initialized');
    
    console.log('🔨 Syncing database (creating tables)...');
    await sequelize.sync({ alter: false, force: false });
    console.log('✅ Database synchronized successfully');
    
    console.log('✅ All database tables created');
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error syncing database:', error.message);
    console.error(error);
    process.exit(1);
  }
}

syncDatabase();

