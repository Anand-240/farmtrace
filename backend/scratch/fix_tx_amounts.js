const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  try {
    console.log('Connecting to DB...');
    const client = await pool.connect();
    
    // Fix existing transactions that mistakenly used totalAmount instead of bookingAmount
    // We assume anything with amount > 10000 and status BOOKING_PAID (or PENDING) might be wrong
    const res = await client.query(`
      UPDATE "Transaction"
      SET "amount" = "amount" * 0.2, "status" = 'BOOKING_PAID'
      WHERE "amount" IN (68000, 87084);
    `);
    
    console.log(`Updated ${res.rowCount} transaction records.`);
    
    client.release();
    process.exit(0);
  } catch (err) {
    console.error('Fix failed:', err);
    process.exit(1);
  }
}

run();
