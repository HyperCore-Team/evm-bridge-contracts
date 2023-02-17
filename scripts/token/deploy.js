require("@nomiclabs/hardhat-ethers");
const { utils } = require("ethers");
const { ethers } = require("hardhat");
const constants = require("../constants.js");

async function deploy() {
    const accounts = await hre.ethers.getSigners();
    let owner = accounts[0];
    await constants.printBalance(owner.address);

    let Token = await ethers.getContractFactory("BEP20Token");
    let token = await Token.connect(owner).deploy("Wrapped ZNN", "wZNN", 8, true, constants.bridgeAddress);
    await token.deployed();
    console.log("wZNN Token deployed to %s", token.address);

    token = await Token.connect(owner).deploy("Wrapped QSR", "wQSR", 8, true, constants.bridgeAddress);
    await token.deployed();
    console.log("wQSR Token deployed to %s", token.address);

    token = await Token.connect(owner).deploy("Zenon LP", "znnLP", 18, false, "0x0000000000000000000000000000000000000000");
    await token.deployed();
    console.log("Zenon LP Token deployed to %s", token.address);

    let mintTx = await token.connect(owner).mint(ethers.utils.parseUnits("10000", 18));
    await mintTx.wait();
    let transferTx = await token.connect(owner).transfer(constants.bridgeAddress, ethers.utils.parseUnits("5000", 18));
    await transferTx.wait();

    token = await Token.connect(owner).deploy("Quasar LP", "qsrLP", 18, false, "0x0000000000000000000000000000000000000000");
    await token.deployed();
    console.log("Quasar LP Token deployed to %s", token.address);

    mintTx = await token.connect(owner).mint(ethers.utils.parseUnits("10000", 18));
    await mintTx.wait();
    transferTx = await token.connect(owner).transfer(constants.bridgeAddress, ethers.utils.parseUnits("5000", 18));
    await transferTx.wait();

    // let tx = {
    //     to: "",
    //     value: ethers.utils.parseEther("100.0"),
    //     gasPrice: await ethers.provider.getGasPrice(),
    // }
    // let sendTx = await owner.sendTransaction(tx);
    // await sendTx.wait();

    return 0;
}

deploy()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });