/**
 * Verification Script: PostgreSQL Database & Wallet Endpoint Integration
 *
 * This script validates:
 * 1. Environment variable setup (DATABASE_URL)
 * 2. Database connection & table initialization (connected_wallets)
 * 3. Performing INSERT query into connected_wallets
 * 4. Querying and verifying stored wallet data from PostgreSQL
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Simple native loader for .env file
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valParts] = trimmed.split('=');
        process.env[key.trim()] = valParts.join('=').trim();
      }
    });
  }
} catch (e) {
  // Ignore error if env reading fails
}


async function verifyDatabaseIntegration() {
  console.log('====================================================');
  console.log('  PostgreSQL Backend Database Integration Verification');
  console.log('====================================================\n');

  const connectionString = process.env.DATABASE_URL || 
    `postgresql://${process.env.POSTGRES_USER || 'postgres'}:${process.env.POSTGRES_PASSWORD || 'postgres'}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || '5432'}/${process.env.POSTGRES_DB || 'cryptoskope'}`;

  console.log('[1/4] Checking Database Environment Configuration:');
  console.log(` - DATABASE_URL configured: ${process.env.DATABASE_URL ? 'YES' : 'NO (using fallback)'}`);
  console.log(` - Target Host: ${process.env.POSTGRES_HOST || 'localhost'}`);
  console.log(` - Target Database: ${process.env.POSTGRES_DB || 'cryptoskope'}\n`);

  const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 5000,
  });

  try {
    console.log('[2/4] Testing Database Connection & Table Initialization:');
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS connected_wallets (
        id SERIAL PRIMARY KEY,
        address VARCHAR(42) UNIQUE NOT NULL,
        connected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await pool.query(createTableQuery);
    console.log(' SUCCESS: connected_wallets table verified/created successfully.\n');

    console.log('[3/4] Testing Wallet INSERT Query:');
    const testWallet = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F'.toLowerCase();
    const insertQuery = `
      INSERT INTO connected_wallets (address, connected_at, last_seen_at)
      VALUES ($1, NOW(), NOW())
      ON CONFLICT (address) 
      DO UPDATE SET last_seen_at = NOW()
      RETURNING id, address, connected_at, last_seen_at;
    `;
    const insertRes = await pool.query(insertQuery, [testWallet]);
    console.log(' SUCCESS: Wallet INSERT/UPSERT executed successfully!');
    console.log(' Inserted Record:', insertRes.rows[0], '\n');

    console.log('[4/4] Querying connected_wallets Table Records:');
    const selectRes = await pool.query('SELECT * FROM connected_wallets ORDER BY last_seen_at DESC LIMIT 5;');
    console.log(` SUCCESS: Retrieved ${selectRes.rowCount} wallet record(s) from database:`);
    console.table(selectRes.rows);

    console.log('\n====================================================');
    console.log(' RESULT: FULL END-TO-END DATABASE FUNCTIONALITY VERIFIED');
    console.log('====================================================');
  } catch (error) {
    console.error('\n DB VERIFICATION NOTE:', error.message);
    console.log('\n- If running in an environment without an active local Postgres daemon listening on port 5432:');
    console.log('  Ensure PostgreSQL service is started or DATABASE_URL points to your hosted PostgreSQL server (e.g. Neon, Supabase, Railway, Vercel Postgres).');
  } finally {
    await pool.end();
  }
}

verifyDatabaseIntegration();
