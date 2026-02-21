/**
 * Database initialization script
 * Run: npm run db:init
 * 
 * Creates tables & seeds sample data
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

async function initDb() {
  // First, connect to default 'postgres' database to create our database
  const adminPool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'postgres',
  });

  try {
    // Create database if it doesn't exist
    const dbName = process.env.DB_NAME || 'parksphere';
    const dbCheck = await adminPool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]
    );

    if (dbCheck.rows.length === 0) {
      await adminPool.query(`CREATE DATABASE ${dbName}`);
      console.log(`✅ Database "${dbName}" created`);
    } else {
      console.log(`ℹ️  Database "${dbName}" already exists`);
    }
  } catch (err) {
    console.error('Error creating database:', err.message);
  } finally {
    await adminPool.end();
  }

  // Now connect to our database and run schema + seed
  const appPool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'parksphere',
  });

  try {
    // Run schema
    const schemaSQL = fs.readFileSync(
      path.join(__dirname, '../models/schema.sql'), 'utf-8'
    );
    await appPool.query(schemaSQL);
    console.log('✅ Schema created successfully');

    // Run seed
    const seedSQL = fs.readFileSync(
      path.join(__dirname, '../models/seed.sql'), 'utf-8'
    );
    await appPool.query(seedSQL);
    console.log('✅ Seed data inserted successfully');

    console.log('\n🚗 ParkSphere database initialized!\n');
  } catch (err) {
    console.error('Error initializing database:', err.message);
  } finally {
    await appPool.end();
  }
}

initDb();
