require("@nomiclabs/hardhat-ethers");
const { ethers } = require("hardhat");
const constants = require("../constants.js");

async function unhalt() {
    const bridge = await ethers.getContractAt("Bridge", constants.bridgeAddress);
    const accounts = await hre.ethers.getSigners();
    let owner = accounts[1];
    console.log("halted: ", await bridge.halted())
    console.log("unhaltedAt: ", await bridge.unhaltedAt())
    let unhaltTx = await bridge.connect(owner).unhalt();
    await unhaltTx.wait();
    console.log("halted: ", await bridge.halted())
    console.log("unhaltedAt: ", await bridge.unhaltedAt())
}

unhalt()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    })
