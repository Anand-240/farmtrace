const mongoose = require('mongoose');
const Transfer = require('../models/Transfer');
const Produce = require('../models/Produce');
const { Queue } = require('bullmq');
const ethers = require('ethers');
require('dotenv').config();

async function fix() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');

  const blockchainQueue = new Queue('blockchainQueue', {
    connection: { url: process.env.REDIS_URL }
  });

  const stuckTransfers = await Transfer.find({
    paymentStatus: 'PAID',
    blockchainStatus: 'PENDING',
    txHash: { $exists: false }
  });

  console.log(`Found ${stuckTransfers.length} stuck transfers`);

  for (const t of stuckTransfers) {
    const produce = await Produce.findById(t.produceMongoId);
    const chainProduceId = t.produceChainId || produce?.produceId || t.produceId;

    if (chainProduceId) {
      console.log(`Queueing fix for transfer ${t._id} (Produce: ${chainProduceId})`);
      
      const toAddress = new ethers.Wallet(process.env.PLATFORM_PRIVATE_KEY).address;

      await blockchainQueue.add('transfer', {
        type: 'TRANSFER',
        data: { produceId: chainProduceId, toAddress, price: t.price, location: t.location },
        transferMongoId: t._id
      });
    } else {
      console.log(`Skipping transfer ${t._id} - No chain ID found yet`);
    }
  }

  process.exit(0);
}

fix();
