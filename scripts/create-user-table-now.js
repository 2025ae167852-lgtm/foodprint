#!/usr/bin/env node

/**
 * Run this to immediately create the user table
 * Usage: DATABASE_URL="your-connection-string" node scripts/create-user-table-now.js
 */

const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL is not defined');
  console.log('\nTo run this script:');
  console.log('node scripts/create-user-table-now.js');
  console.log('\nMake sure DATABASE_URL is set in your environment');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: {
    require: true,
    rejectUnauthorized: false
  }
});

async function createUserTable() {
  const client = await pool.connect();
  
  try {
    console.log('🔌 Connecting to database...');
    
    console.log('📊 Creating user table...');
    
    const result = await client.query(`
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
    
    console.log('✅ User table created successfully!');
    
    // Verify the table exists
    const check = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'user';
    `);
    
    if (check.rows.length > 0) {
      console.log('✅ Verified: user table exists');
      console.log('✅ Registration should now work!');
    } else {
      console.log('⚠️  Warning: Could not verify table creation');
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('Full error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

createUserTable();

