require("@nomiclabs/hardhat-ethers");
const { ethers } = require("hardhat");
const publicKeyToAddress = require("ethereum-public-key-to-address");
const constants = require("../constants.js");

async function change() {
    const accounts = await hre.ethers.getSigners();
    let owner = accounts[1];
    const bridge = await ethers.getContractAt("Bridge", constants.bridgeAddress);
    console.log(await bridge.tssAddress());
    let tssAddress = publicKeyToAddress(Buffer.from('', 'base64'))
    let changeTssGas = await bridge.connect(owner).estimateGas.changeTssAddress(tssAddress, "0x", "0x")
    let changeTssTx = await bridge.connect(owner).changeTssAddress(tssAddress, "0x", "0x")
    await changeTssTx.wait();

    console.log(await bridge.timeChallengesInfo("changeTssAddress"));

    await constants.sleep(10 * 1000)

    changeTssGas = await bridge.connect(owner).estimateGas.changeTssAddress(tssAddress, "0x", "0x")
    changeTssTx = await bridge.connect(owner).changeTssAddress(tssAddress, "0x", "0x")
    await changeTssTx.wait();

    console.log(await bridge.timeChallengesInfo("changeTssAddress"));

    console.log(await bridge.tssAddress());
}

change()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    })