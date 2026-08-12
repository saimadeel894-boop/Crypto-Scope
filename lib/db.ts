import { Pool } from 'pg';

let pool: Pool | null = null;

export function isDbConfigured(): boolean {
  return !!process.env.DATABASE_URL || !!process.env.POSTGRES_HOST;
}

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL || 
      `postgresql://${process.env.POSTGRES_USER || 'postgres'}:${process.env.POSTGRES_PASSWORD || 'postgres'}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || '5432'}/${process.env.POSTGRES_DB || 'cryptoskope'}`;

    const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

    pool = new Pool({
      connectionString,
      ssl: isProduction ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

let isInitialized = false;

export async function initDb(): Promise<void> {
  if (isInitialized) return;
  
  const clientPool = getPool();
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS connected_wallets (
      id SERIAL PRIMARY KEY,
      address VARCHAR(42) UNIQUE NOT NULL,
      connected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  
  try {
    await clientPool.query(createTableQuery);
    isInitialized = true;
    console.log('[DB] connected_wallets table verified/created successfully.');
  } catch (error) {
    console.error('[DB Error] Failed to initialize connected_wallets table:', error);
    throw error;
  }
}

export async function saveWalletAddress(address: string): Promise<{ id?: number; address: string; connected_at?: Date; last_seen_at?: Date; dbStatus?: string }> {
  const normalizedAddress = address.toLowerCase();

  if (!isDbConfigured() && process.env.VERCEL) {
    console.warn('[DB Warning] DATABASE_URL environment variable is not configured on Vercel.');
    return {
      address: normalizedAddress,
      dbStatus: 'unconfigured',
    };
  }

  try {
    await initDb();
    const clientPool = getPool();

    // Upsert query: ON CONFLICT DO UPDATE SET last_seen_at = NOW()
    const query = `
      INSERT INTO connected_wallets (address, connected_at, last_seen_at)
      VALUES ($1, NOW(), NOW())
      ON CONFLICT (address) 
      DO UPDATE SET last_seen_at = NOW()
      RETURNING id, address, connected_at, last_seen_at;
    `;

    const result = await clientPool.query(query, [normalizedAddress]);
    return result.rows[0];
  } catch (error) {
    console.error(`[DB Error] Failed to save wallet address ${address}:`, error);
    throw error;
  }
}

