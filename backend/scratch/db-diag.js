require('dotenv').config();
const mongoose = require('mongoose');
const { pool: pgPool } = require('../prisma/client');
const { pingRedis } = require('../utils/queue');
const elasticClient = require('../utils/elasticClient');

async function testAll() {
  console.log('--- Database Diagnostics ---');

  // 1. MongoDB
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const admin = mongoose.connection.db.admin();
    const ping = await admin.ping();
    console.log('✅ MongoDB: Connected and Pinged successfully', ping);
    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ MongoDB: Failed', err.message);
  }

  // 2. PostgreSQL
  try {
    const res = await pgPool.query('SELECT NOW() as now');
    console.log('✅ PostgreSQL: Connected and Query successful', res.rows[0]);
  } catch (err) {
    console.error('❌ PostgreSQL: Failed', err.message);
  }

  // 3. Redis
  try {
    await pingRedis();
    console.log('✅ Redis: Connected and Pinged successfully');
  } catch (err) {
    console.error('❌ Redis: Failed', err.message);
  }

  // 4. Elasticsearch
  try {
    const info = await elasticClient.info();
    console.log('✅ Elasticsearch: Connected and Info retrieved');
    // console.log(info);
  } catch (err) {
    console.error('❌ Elasticsearch: Failed', err.message);
    if (err.name === 'ProductNotSupportedError') {
       console.log('   Note: This is a common issue with Bonsai/Managed ES where the client strict product check fails.');
    }
  }

  process.exit(0);
}

testAll();
