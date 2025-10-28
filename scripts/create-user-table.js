#!/usr/bin/env node

const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL not defined');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { require: true, rejectUnauthorized: false }
});

async function createUserTable() {
  const client = await pool.connect();
  
  try {
    await client.query(`
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
      
      -- Try to add indexes and constraints (will fail silently if exist)
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'user_email_idx') THEN
          CREATE INDEX "user_email_idx" ON "user" ("email");
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'user_phoneNumber_idx') THEN
          CREATE INDEX "user_phoneNumber_idx" ON "user" ("phoneNumber");
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- Index might already exist
      END $$;
      
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_email_unique') THEN
          ALTER TABLE "user" ADD CONSTRAINT "user_email_unique" UNIQUE ("email");
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_phoneNumber_unique') THEN
          ALTER TABLE "user" ADD CONSTRAINT "user_phoneNumber_unique" UNIQUE ("phoneNumber");
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- Constraint might already exist
      END $$;
    `);
    
    console.log('✅ User table created successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

createUserTable();

