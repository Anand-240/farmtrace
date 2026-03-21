const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying FarmTrace...");

  const FarmTrace = await ethers.getContractFactory("FarmTrace");
  const contract = await FarmTrace.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("FarmTrace deployed at:", address);

  // Backend ke liye address save karo
  const addressData = { FarmTrace: address };
  
  const backendPath = path.join(__dirname, "../../backend/blockchain");
  if (!fs.existsSync(backendPath)) {
    fs.mkdirSync(backendPath, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(backendPath, "contractAddress.json"),
    JSON.stringify(addressData, null, 2)
  );

  // ABI bhi copy karo
  const abiSource = path.join(
    __dirname,
    "../artifacts/contracts/FarmTrace.sol/FarmTrace.json"
  );
  fs.copyFileSync(
    abiSource,
    path.join(backendPath, "FarmTraceABI.json")
  );

  console.log("Address + ABI backend mein save ho gaya!");
  console.log("Etherscan:", `https://sepolia.etherscan.io/address/${address}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
