#!/usr/bin/env node

/**
 * Initialize database tables manually
 * This bypasses Sequelize sync and creates tables directly
 */

const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL is not defined');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: {
    require: true,
    rejectUnauthorized: false
  }
});

const createTablesSQL = `
-- Create user table
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

-- Create indexes
CREATE INDEX IF NOT EXISTS "user_email_idx" ON "user" ("email");
CREATE INDEX IF NOT EXISTS "user_phoneNumber_idx" ON "user" ("phoneNumber");

-- Add unique constraints
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_email_unique') THEN
        ALTER TABLE "user" ADD CONSTRAINT "user_email_unique" UNIQUE ("email");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_phoneNumber_unique') THEN
        ALTER TABLE "user" ADD CONSTRAINT "user_phoneNumber_unique" UNIQUE ("phoneNumber");
    END IF;
END \$\$;
`;

async function initDatabase() {
  try {
    console.log('🔌 Connecting to database...');
    const client = await pool.connect();
    console.log('✅ Connected to database');
    
    console.log('📊 Creating tables...');
    await client.query(createTablesSQL);
    console.log('✅ Tables created successfully');
    
    client.release();
    await pool.end();
    
    console.log('✅ Database initialization complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

initDatabase();

