require("@nomiclabs/hardhat-ethers");
const { utils } = require("ethers");
const { ethers } = require("hardhat");
const constants = require("../constants.js");
const publicKeyToAddress = require("ethereum-public-key-to-address");

async function deploy() {
    const accounts = await hre.ethers.getSigners();
    let owner = accounts[1];
    let owner2 = accounts[2];
    let owner3 = accounts[3];
    await constants.printBalance(owner.address);
    const Bridge = await ethers.getContractFactory("Bridge");

    const bridge = await Bridge.connect(owner).deploy(15, 1, 1, 5, 12, [owner.address, owner2.address, owner3.address]);
    await bridge.deployed();

    console.log("Bridge address: ", bridge.address);

    return 0;
}

deploy()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });