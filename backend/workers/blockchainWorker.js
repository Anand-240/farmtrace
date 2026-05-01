const { Worker } = require('bullmq');
const { registerOnChain, transferOnChain } = require('../blockchain/blockchainService');
const logger = require('../utils/logger').child({ module: 'blockchainWorker' });

const connection = {
  url: process.env.REDIS_URL
};

const blockchainWorker = new Worker('blockchainQueue', async job => {
  const { type, data } = job.data;

  logger.info({ jobId: job.id, type }, 'Processing blockchain job');

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
  logger.info({ jobId: job.id, txHash: returnvalue?.txHash }, 'Blockchain job completed');
});

blockchainWorker.on('failed', (job, err) => {
  logger.error({ jobId: job.id, err }, 'Blockchain job failed');
});

module.exports = blockchainWorker;
