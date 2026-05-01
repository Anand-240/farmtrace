const { Worker } = require('bullmq');
const { registerOnChain, transferOnChain } = require('../blockchain/blockchainService');

const connection = {
  url: process.env.REDIS_URL
};

const blockchainWorker = new Worker('blockchainQueue', async job => {
  const { type, data } = job.data;
  
  if (type === 'REGISTER') {
    const { farmerName, cropType, origin, farmPrice } = data;
    return await registerOnChain(farmerName, cropType, origin, farmPrice);
  }
  
  if (type === 'TRANSFER') {
    const { produceId, toAddress, price, location } = data;
    return await transferOnChain(produceId, toAddress, price, location);
  }

  throw new Error(`Unknown job type: ${type}`);
}, { connection });

blockchainWorker.on('completed', (job, returnvalue) => {
  console.log(`Job ${job.id} has completed! TxHash: ${returnvalue?.txHash}`);
});

blockchainWorker.on('failed', (job, err) => {
  console.error(`Job ${job.id} has failed with ${err.message}`);
});

module.exports = blockchainWorker;
