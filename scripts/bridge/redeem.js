require("@nomiclabs/hardhat-ethers");
const { ethers } = require("hardhat");
const constants = require("../constants.js");
const {
    defaultAbiCoder: abiCoder,
    arrayify,
    keccak256,
} = ethers.utils;

async function redeem() {
    let gasPrice = await ethers.provider.getGasPrice();

    const bridge = await ethers.getContractAt("Bridge", constants.bridgeAddress);
    const token = await ethers.getContractAt("BEP20Token", constants.wZNNAddress);
    const accounts = await hre.ethers.getSigners();
    let user1 = accounts[0];

    let bnbBalance = await constants.printBalance(user1.address);
    let oldTokenBalance = await token.balanceOf(user1.address);
    console.log("Old token balance %s for address %s", constants.formatAmount(oldTokenBalance), user1.address);

    const redeemAmount = ethers.utils.parseUnits("", 8);
    const nonce = "";
    const signature = ""

    let override = {
        gasPrice: gasPrice
    }
    let redeemGas = await bridge.connect(user1).estimateGas.redeem("", constants.wZNNAddress, redeemAmount, nonce, signature, override);
    let redeemCost = redeemGas.mul(gasPrice);
    if(redeemCost.lt(bnbBalance)) {
        override.gasLimit = redeemGas;
        let redeemTx = await bridge.connect(user1).redeem("", constants.wZNNAddress, redeemAmount, nonce, signature, override);
        await redeemTx.wait();
        console.log("Withdrawn %s", constants.formatAmount(redeemAmount));
    } else {
        console.log("Not enough BNB for redeem");
        console.log("Has: %s", ethers.utils.formatEther(bnbBalance));
        console.log("Needs: %s", ethers.utils.formatEther(redeemCost));
        return;
    }
    let newTokenBalance = await token.balanceOf(user1.address);
    console.log("New token balance %d for address %s", constants.formatAmount(newTokenBalance), user1.address);
    console.log("Difference: %s, Redeem amount: %s, Equal: %s", constants.formatAmount(newTokenBalance.sub(oldTokenBalance)), constants.formatAmount(redeemAmount), newTokenBalance.sub(oldTokenBalance).eq(redeemAmount));
}

redeem()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    })
