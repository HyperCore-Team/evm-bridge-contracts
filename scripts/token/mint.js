require("@nomiclabs/hardhat-ethers");
const { ethers } = require("hardhat");
const constants = require("../constants.js");
const {bridgeAddress, wZNNAddress, formatAmount} = require("../constants");

async function deploy() {
    const accounts = await hre.ethers.getSigners();
    let owner = accounts[1];
    await constants.printBalance(owner.address);

    // Get Token
    const Token = await ethers.getContractAt("BEP20Token", wZNNAddress);

    // Mint to the owner 10000000
    const mintAmount = constants.parseAmount("50000");

    let override = {
        gasPrice: await ethers.provider.getGasPrice()
    }
    override.gasLimit = await Token.connect(owner).estimateGas.mint(mintAmount);

    let oldOwnerBalance = await Token.balanceOf(owner.address);

    let mintTx = await Token.connect(owner).mint(mintAmount, override);
    await mintTx.wait();
    console.log("Minted %s for owner", formatAmount(mintAmount));

    let newOwnerBalance = await Token.balanceOf(owner.address);
    console.log("Owner: %s, Old balance: %s, New balance: %s", owner.address, formatAmount(oldOwnerBalance), formatAmount(newOwnerBalance), oldOwnerBalance.eq(newOwnerBalance.sub(mintAmount)));

    let oldBridgeBalance = await Token.balanceOf(bridgeAddress);

    override.gasLimit = await Token.connect(owner).estimateGas.transfer(bridgeAddress, mintAmount);
    let transferTx = await Token.connect(owner).transfer(bridgeAddress, mintAmount);
    await transferTx.wait();
    console.log('Sent %s to %s', formatAmount(mintAmount), bridgeAddress)

    let newBridgeBalance = await Token.balanceOf(bridgeAddress);
    newOwnerBalance = await Token.balanceOf(owner.address);

    console.log("Owner: %s, Old balance: %s, New balance: %s, Equal: %s", owner.address, formatAmount(oldOwnerBalance), formatAmount(newOwnerBalance), oldOwnerBalance.eq(newOwnerBalance));
    console.log("Bridge: %s, Old balance: %s, New balance: %s, Zero: %s", bridgeAddress, formatAmount(oldBridgeBalance), formatAmount(newBridgeBalance), formatAmount(newBridgeBalance.sub(oldBridgeBalance).sub(mintAmount)));

    //// QSR
    // Get Token
    const Token2 = await ethers.getContractAt("BEP20Token2", wZNNAddress);

    override.gasLimit = await Token2.connect(owner).estimateGas.mint(mintAmount);
    oldOwnerBalance = await Token2.balanceOf(owner.address);

    mintTx = await Token2.connect(owner).mint(mintAmount, override);
    await mintTx.wait();
    console.log("Minted %s for owner", formatAmount(mintAmount));

    newOwnerBalance = await Token2.balanceOf(owner.address);
    console.log("Owner: %s, Old balance: %s, New balance: %s", owner.address, formatAmount(oldOwnerBalance), formatAmount(newOwnerBalance), oldOwnerBalance.eq(newOwnerBalance.sub(mintAmount)));

    oldBridgeBalance = await Token2.balanceOf(bridgeAddress);

    override.gasLimit = await Token2.connect(owner).estimateGas.transfer(bridgeAddress, mintAmount);
    transferTx = await Token2.connect(owner).transfer(bridgeAddress, mintAmount);
    await transferTx.wait();
    console.log('Sent %s to %s', formatAmount(mintAmount), bridgeAddress)

    newBridgeBalance = await Token2.balanceOf(bridgeAddress);
    newOwnerBalance = await Token2.balanceOf(owner.address);

    console.log("Owner: %s, Old balance: %s, New balance: %s, Equal: %s", owner.address, formatAmount(oldOwnerBalance), formatAmount(newOwnerBalance), oldOwnerBalance.eq(newOwnerBalance));
    console.log("Bridge: %s, Old balance: %s, New balance: %s, Zero: %s", bridgeAddress, formatAmount(oldBridgeBalance), formatAmount(newBridgeBalance), formatAmount(newBridgeBalance.sub(oldBridgeBalance).sub(mintAmount)));
    return 0;
}

deploy()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
