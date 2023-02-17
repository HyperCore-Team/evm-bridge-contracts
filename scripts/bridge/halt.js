require("@nomiclabs/hardhat-ethers");
const { ethers } = require("hardhat");
const constants = require("../constants.js");

async function halt() {
    const bridge = await ethers.getContractAt("Bridge", constants.bridgeAddress);
    const accounts = await hre.ethers.getSigners();
    let owner = accounts[1];
    console.log("halted: ", await bridge.halted())
    let haltTx = await bridge.connect(owner).halt();
    await haltTx.wait();
    console.log("halted: ", await bridge.halted())
}

halt()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    })
