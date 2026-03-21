require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: "0.8.19",
  networks: {
    sepolia: {
      url: process.env.ALCHEMY_RPC_URL || "",
      accounts: process.env.PLATFORM_PRIVATE_KEY
        ? [process.env.PLATFORM_PRIVATE_KEY]
        : []
    }
  }
};
