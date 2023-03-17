require("@nomiclabs/hardhat-ethers");
const { ethers } = require("hardhat");
const publicKeyToAddress = require("ethereum-public-key-to-address");
const constants = require("../constants.js");

async function change() {
    const accounts = await hre.ethers.getSigners();
    let owner = accounts[1];
    const bridge = await ethers.getContractAt("Bridge", constants.bridgeAddress);
    console.log(await bridge.tss());
    let tss = publicKeyToAddress(Buffer.from('', 'base64'))
    let setTssGas = await bridge.connect(owner).estimateGas.setTss(tss, "0x", "0x")
    let setTssTx = await bridge.connect(owner).setTss(tss, "0x", "0x")
    await setTssTx.wait();

    console.log(await bridge.timeChallengesInfo("setTss"));

    await constants.sleep(10 * 1000)

    setTssGas = await bridge.connect(owner).estimateGas.setTss(tss, "0x", "0x")
    setTssTx = await bridge.connect(owner).setTss(tss, "0x", "0x")
    await setTssTx.wait();

    console.log(await bridge.timeChallengesInfo("setTss"));

    console.log(await bridge.tss());
}

change()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    })