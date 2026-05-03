const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  try {
    console.log('Connecting to DB...');
    const client = await pool.connect();
    console.log('Connected!');

    await client.query(`
      CREATE TABLE IF NOT EXISTS "Transaction" (
        "id" TEXT NOT NULL,
        "produceId" TEXT NOT NULL,
        "cropType" TEXT,
        "fromPhone" TEXT NOT NULL,
        "fromName" TEXT,
        "toPhone" TEXT NOT NULL,
        "toName" TEXT,
        "amount" DOUBLE PRECISION NOT NULL,
        "pricePerKg" DOUBLE PRECISION,
        "quantity" DOUBLE PRECISION,
        "transferType" TEXT,
        "paymentId" TEXT,
        "txHash" TEXT,
        "status" TEXT NOT NULL DEFAULT 'COMPLETED',
        "type" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,

        CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log('Table "Transaction" created/verified!');

    await client.query(`
      CREATE TABLE IF NOT EXISTS "Escrow" (
        "id" TEXT NOT NULL,
        "transferId" TEXT NOT NULL,
        "totalAmount" DOUBLE PRECISION NOT NULL,
        "bookingAmount" DOUBLE PRECISION NOT NULL,
        "dispatchAmount" DOUBLE PRECISION NOT NULL,
        "deliveryAmount" DOUBLE PRECISION NOT NULL,
        "bookingPaid" BOOLEAN NOT NULL DEFAULT false,
        "bookingPaidAt" TIMESTAMP(3),
        "dispatchReleased" BOOLEAN NOT NULL DEFAULT false,
        "dispatchReleasedAt" TIMESTAMP(3),
        "deliveryReleased" BOOLEAN NOT NULL DEFAULT false,
        "deliveryReleasedAt" TIMESTAMP(3),
        "refundReason" TEXT,
        "refundAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "refundRequestedAt" TIMESTAMP(3),
        "refundCompletedAt" TIMESTAMP(3),
        "razorpayPaymentId" TEXT,
        "razorpayOrderId" TEXT,
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,

        CONSTRAINT "Escrow_pkey" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "Escrow_transferId_key" ON "Escrow"("transferId");
    `);
    console.log('Table "Escrow" created/verified!');

    client.release();
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();
