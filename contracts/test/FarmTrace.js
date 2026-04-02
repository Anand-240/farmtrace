const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FarmTrace", function () {
  it("Should deploy FarmTrace successfully", async function () {
    const FarmTrace = await ethers.getContractFactory("FarmTrace");
    const farmTrace = await FarmTrace.deploy();
    
    expect(farmTrace.target).to.not.be.undefined;
  });

  it("Should register a produce successfully", async function () {
    const FarmTrace = await ethers.getContractFactory("FarmTrace");
    const farmTrace = await FarmTrace.deploy();

    const tx = await farmTrace.registerProduce("Anand", "Wheat", "Punjab", 500);
    await tx.wait(); // wait for the transaction to be mined

    // Since we don't have the explicit ID, we just check it didn't revert
    expect(tx.hash).to.not.be.null;
  });
});
