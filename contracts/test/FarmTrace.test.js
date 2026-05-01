const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("FarmTrace", function () {
  let farmTrace;
  let owner;
  let scanner;
  let otherAccount;

  beforeEach(async function () {
    [owner, scanner, otherAccount] = await ethers.getSigners();

    const FarmTrace = await ethers.getContractFactory("FarmTrace");
    farmTrace = await upgrades.deployProxy(FarmTrace, [], { kind: 'uups' });

    const SCANNER_ROLE = await farmTrace.SCANNER_ROLE();
    await farmTrace.grantRole(SCANNER_ROLE, scanner.address);
  });

  describe("Deployment", function () {
    it("Should set the right roles", async function () {
      const DEFAULT_ADMIN_ROLE = await farmTrace.DEFAULT_ADMIN_ROLE();
      const UPGRADER_ROLE = await farmTrace.UPGRADER_ROLE();
      const SCANNER_ROLE = await farmTrace.SCANNER_ROLE();

      expect(await farmTrace.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await farmTrace.hasRole(UPGRADER_ROLE, owner.address)).to.be.true;
      expect(await farmTrace.hasRole(SCANNER_ROLE, scanner.address)).to.be.true;
    });
  });

  describe("Transactions", function () {
    it("Should allow a scanner to register produce", async function () {
      await expect(farmTrace.connect(scanner).registerProduce("Farmer John", "Wheat", "Farm 1", 100))
        .to.emit(farmTrace, "ProduceRegistered");
    });

    it("Should fail if non-scanner tries to register produce", async function () {
      await expect(farmTrace.connect(otherAccount).registerProduce("Farmer John", "Wheat", "Farm 1", 100))
        .to.be.revertedWithCustomError(farmTrace, "AccessControlUnauthorizedAccount");
    });

    it("Should allow a scanner to transfer produce and emit CheckpointAdded", async function () {
      const tx = await farmTrace.connect(scanner).registerProduce("Farmer John", "Wheat", "Farm 1", 100);
      const receipt = await tx.wait();
      const produceId = receipt.logs[0].args[0];

      await expect(farmTrace.connect(scanner).transferProduce(produceId, otherAccount.address, 150, "Warehouse A"))
        .to.emit(farmTrace, "CheckpointAdded")
        .withArgs(produceId, scanner.address, otherAccount.address, 150, "Warehouse A", (any) => true)
        .and.to.emit(farmTrace, "ProduceTransferred")
        .withArgs(produceId, scanner.address, otherAccount.address, 150);
    });
  });

  describe("Upgradeability", function () {
    it("Should upgrade the contract and retain data", async function () {
      const tx = await farmTrace.connect(scanner).registerProduce("Farmer John", "Wheat", "Farm 1", 100);
      const receipt = await tx.wait();
      const produceId = receipt.logs[0].args[0];

      const FarmTraceV2 = await ethers.getContractFactory("FarmTrace");
      const upgraded = await upgrades.upgradeProxy(await farmTrace.getAddress(), FarmTraceV2);

      const produce = await upgraded.getProduce(produceId);
      expect(produce.farmerName).to.equal("Farmer John");
    });
  });
});
