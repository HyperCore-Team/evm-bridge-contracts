require("@nomiclabs/hardhat-ethers");
const { utils } = require("ethers");
const { ethers } = require("hardhat");
const constants = require("../constants.js");

async function deploy() {
    const accounts = await hre.ethers.getSigners();
    let owner = accounts[1];
    await constants.printBalance(owner.address);

    const Proxy = await ethers.getContractFactory("LiquidityProxy");
    let RouterAddress = ""
    let wZNNAddress = ""
    const proxy = await Proxy.connect(owner).deploy(RouterAddress, wZNNAddress);
    await proxy.deployed();

    console.log("Proxy address: ", proxy.address);

    return 0;
}

deploy()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });