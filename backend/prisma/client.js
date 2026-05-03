const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL is missing! Check Vercel environment variables.');
}

const pool = new Pool({ 
  connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ 
  adapter,
  log: ['error', 'warn']
});

module.exports = { prisma, pool };
