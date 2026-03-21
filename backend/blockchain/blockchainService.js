const { ethers } = require('ethers');
const ABI = require('./FarmTraceABI.json');
const addressData = require('./contractAddress.json');

let contract;

function getContract() {
  if (contract) return contract;
  const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_RPC_URL);
  const platformWallet = new ethers.Wallet(process.env.PLATFORM_PRIVATE_KEY, provider);
  contract = new ethers.Contract(addressData.FarmTrace, ABI.abi, platformWallet);
  return contract;
}

async function registerOnChain(farmerName, cropType, origin, farmPrice) {
  try {
    const c = getContract();
    const tx = await c.registerProduce(
      farmerName, cropType, origin, farmPrice * 100,
      { gasLimit: 300000 }
    );
    const receipt = await tx.wait();
    const produceId = receipt.logs[0]?.topics[1];
    return {
      success: true,
      produceId,
      txHash: tx.hash,
      etherscanUrl: `https://sepolia.etherscan.io/tx/${tx.hash}`
    };
  } catch (err) {
    console.error('Blockchain register error:', err.message);
    return { success: false, error: err.message };
  }
}

async function transferOnChain(produceId, toAddress, price, location) {
  try {
    const c = getContract();
    const tx = await c.transferProduce(
      produceId, toAddress, price * 100, location,
      { gasLimit: 200000 }
    );
    await tx.wait();
    return {
      success: true,
      txHash: tx.hash,
      etherscanUrl: `https://sepolia.etherscan.io/tx/${tx.hash}`
    };
  } catch (err) {
    console.error('Blockchain transfer error:', err.message);
    return { success: false, error: err.message };
  }
}

async function getHistoryFromChain(produceId) {
  try {
    const c = getContract();
    const history = await c.getHistory(produceId);
    const produce = await c.getProduce(produceId);
    return { success: true, history, produce };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { registerOnChain, transferOnChain, getHistoryFromChain };
