const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const multisigAdminAddress = process.env.MULTISIG_ADMIN_ADDRESS;

  if (!multisigAdminAddress) {
    console.warn("WARNING: MULTISIG_ADMIN_ADDRESS is not set in .env. Deployer will retain admin roles.");
  }

  const FarmTrace = await ethers.getContractFactory("FarmTrace");
  
  // Deploy the proxy
  console.log("Deploying FarmTrace proxy...");
  const farmTrace = await upgrades.deployProxy(FarmTrace, [], { kind: 'uups' });
  await farmTrace.waitForDeployment();

  const farmTraceAddress = await farmTrace.getAddress();
  console.log("FarmTrace Proxy deployed to:", farmTraceAddress);

  // Grant SCANNER_ROLE to the deployer for testing convenience (Optional)
  const SCANNER_ROLE = await farmTrace.SCANNER_ROLE();
  await farmTrace.grantRole(SCANNER_ROLE, deployer.address);
  console.log("Granted SCANNER_ROLE to deployer");

  // Transfer Admin and Upgrader roles to the Multisig Wallet
  if (multisigAdminAddress) {
    const DEFAULT_ADMIN_ROLE = await farmTrace.DEFAULT_ADMIN_ROLE();
    const UPGRADER_ROLE = await farmTrace.UPGRADER_ROLE();

    console.log(`Granting roles to Multisig Admin: ${multisigAdminAddress}`);
    await farmTrace.grantRole(DEFAULT_ADMIN_ROLE, multisigAdminAddress);
    await farmTrace.grantRole(UPGRADER_ROLE, multisigAdminAddress);

    console.log("Revoking roles from deployer...");
    await farmTrace.revokeRole(DEFAULT_ADMIN_ROLE, deployer.address);
    await farmTrace.revokeRole(UPGRADER_ROLE, deployer.address);
    console.log("Roles successfully transferred to Multisig!");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
