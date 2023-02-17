require("@nomiclabs/hardhat-ethers");
const { ethers } = require("hardhat");
const constants = require("../constants.js");

async function allow() {
    const bridge = await ethers.getContractAt("Bridge", constants.bridgeAddress);
    const accounts = await hre.ethers.getSigners();
    let owner = accounts[1];
    console.log(await bridge.allowKeyGen())
    let allowTx = await bridge.connect(owner).setAllowKeyGen(true);
    await allowTx.wait();
    console.log(await bridge.allowKeyGen())
}

allow()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    })
