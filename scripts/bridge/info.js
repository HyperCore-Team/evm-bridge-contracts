require("@nomiclabs/hardhat-ethers");
const { utils } = require("ethers");
const { ethers } = require("hardhat");
const constants = require("../constants.js");
const publicKeyToAddress = require("ethereum-public-key-to-address");

async function info() {
    const accounts = await hre.ethers.getSigners();
    let owner = accounts[1];
    let owner2 = accounts[2];
    let owner3 = accounts[3];
    const bridge = await ethers.getContractAt("Bridge", constants.bridgeAddress);

    console.log(await bridge.tokensInfo("0x5FbDB2315678afecb367f032d93F642f64180aa3"));
    console.log(await bridge.tokensInfo("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"));


    return 0
}

info()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });