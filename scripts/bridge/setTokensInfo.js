require("@nomiclabs/hardhat-ethers");
const { utils } = require("ethers");
const { ethers } = require("hardhat");
const constants = require("../constants.js");
const publicKeyToAddress = require("ethereum-public-key-to-address");

async function setTokensInfo() {
    const accounts = await hre.ethers.getSigners();
    let owner = accounts[1];
    const bridge = await ethers.getContractAt("Bridge", constants.bridgeAddress);

    console.log(await bridge.tokensInfo("0x5FbDB2315678afecb367f032d93F642f64180aa3"));
    console.log(await bridge.tokensInfo("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"));

    // same amount as znn
    for (let i = 0; i < 2; i++) {
        let minAmountZnn = ethers.utils.parseUnits("0.1", 8)
        let addTokenGas = await bridge.connect(owner).estimateGas.setTokenInfo(constants.wZNNAddress, minAmountZnn, 12, true, true, true)
        let addTokenTx = await bridge.connect(owner).setTokenInfo(constants.wZNNAddress, minAmountZnn, 12, true, true, true)
        await addTokenTx.wait();
        await constants.sleep(10 * 1000)

        console.log(await bridge.timeChallengesInfo("setTokenInfo"));
    }

    for (let i = 0; i < 2; i++) {
        let minAmountQsr = ethers.utils.parseUnits("1", 8)
        let addTokenGasQsr = await bridge.connect(owner).estimateGas.setTokenInfo(constants.wQSRAddress, minAmountQsr, 12, true, true, true)
        let addTokenTxQsr = await bridge.connect(owner).setTokenInfo(constants.wQSRAddress, minAmountQsr, 12, true, true, true)
        await addTokenTxQsr.wait();
        await constants.sleep(10 * 1000)
    }

    console.log(await bridge.tokensInfo(constants.wZNNAddress));
    console.log(await bridge.tokensInfo(constants.wQSRAddress));

    for (let i = 0; i < 2; i++) {
        let minAmountZnnLP = ethers.utils.parseUnits("0.000001", 18)
        let addTokenGasZnnLP = await bridge.connect(owner).estimateGas.setTokenInfo(constants.wZnnLP, minAmountZnnLP, 12, true, true, false)
        let addTokenTxZnnLP = await bridge.connect(owner).setTokenInfo(constants.wZnnLP, minAmountZnnLP, 12, true, true, false)
        await addTokenTxZnnLP.wait();
        await constants.sleep(10 * 1000)
    }

    for (let i = 0; i < 2; i++) {
        let minAmountQsrLP = ethers.utils.parseUnits("0.000001", 18)
        let addTokenGasQsrLP = await bridge.connect(owner).estimateGas.setTokenInfo(constants.wQsrLP, minAmountQsrLP, 12, true, true, false)
        let addTokenTxQsrLP = await bridge.connect(owner).setTokenInfo(constants.wQsrLP, minAmountQsrLP, 12, true, true, false)
        await addTokenTxQsrLP.wait();
        await constants.sleep(10 * 1000)
    }

    return 0
}

setTokensInfo()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });