const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('❌ DATABASE_URL is missing! Set it in Render.com (or your host) environment variables.');
}

const pool = new Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 8000,
});

pool.on('error', (err, client) => {
  // 57P01 = admin_shutdown: Supabase pooler cycles connections — safe to ignore
  if (err.code === '57P01') return;
  console.error('❌ Unexpected pg pool error:', err.message);
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ 
  adapter,
  log: ['error', 'warn']
});

module.exports = { prisma, pool };
