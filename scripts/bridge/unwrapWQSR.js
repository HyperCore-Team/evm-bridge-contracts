require("@nomiclabs/hardhat-ethers");
const { ethers } = require("hardhat");
const constants = require("../constants.js");

async function unwrap() {
    let gasPrice = await ethers.provider.getGasPrice();
    const bridge = await ethers.getContractAt("Bridge", constants.bridgeAddress);
    const token = await ethers.getContractAt("BEP20Token2", constants.wQSRAddress);

    const accounts = await hre.ethers.getSigners();
    let user1 = accounts[0];

    let bnbBalance = await constants.printBalance(user1.address);
    let oldTokenBalance = await token.balanceOf(user1.address);
    console.log("Token balance %s for address %s", constants.formatAmount(oldTokenBalance), user1.address);

    let allowance = await token.connect(user1).allowance(user1.address, bridge.address);
    console.log("Allowance: %s", constants.formatAmount(allowance));

    let unwrapAmount = ethers.utils.parseUnits("10", 8);

    if(allowance.lt(unwrapAmount)) {
        // let toAllow = unwrapAmount.sub(allowance);
        // just allow all for tests
        let toAllow = oldTokenBalance;
        let allowanceGas = await token.connect(user1).estimateGas.increaseAllowance(bridge.address, toAllow);

        let allowanceCost = allowanceGas.mul(gasPrice);
        if(bnbBalance.lt(allowanceCost)) {
            console.log("Not enough BNB for fees");
            console.log("Has: %s", ethers.utils.formatEther(bnbBalance));
            console.log("Needs: %s", ethers.utils.formatEther(allowanceCost));
            return;
        }

        let ovAl = {
            gasLimit: allowanceGas,
            gasPrice: gasPrice
        }

        let allowanceTx = await token.connect(user1).increaseAllowance(bridge.address, toAllow, ovAl);
        await allowanceTx.wait();
        bnbBalance = bnbBalance.sub(allowanceCost);
        console.log("Increased allowance of %s", constants.formatAmount(toAllow));
    } else {
        console.log("No allowance needed");
    }

    let ovUnwrap = {
        gasPrice: gasPrice
    }
    let alphanetAddress = `z1qrgwpdhnefss39rhzpf9r6nx3dlta2ysh29feh`;
    let unwrapGas = await bridge.connect(user1).estimateGas.unwrap(constants.wQSRAddress, unwrapAmount, alphanetAddress, ovUnwrap);
    let unwrapCost = unwrapGas.mul(gasPrice);
    if(unwrapCost.lt(bnbBalance)) {
        ovUnwrap.gasLimit = unwrapGas;
        let unwrapTx = await bridge.connect(user1).unwrap(constants.wQSRAddress, unwrapAmount, alphanetAddress, ovUnwrap);
        await unwrapTx.wait();
        console.log("unwrapped %s", constants.formatAmount(unwrapAmount));
    } else {
        console.log("Not enough BNB for deposit");
        console.log("Has: %s BNB", ethers.utils.formatEther(bnbBalance));
        console.log("Needs: %s BNB", ethers.utils.formatEther(unwrapCost));
    }

    let newTokenBalance = await token.balanceOf(user1.address);
    console.log("New token balance %d for address %s", constants.formatAmount(newTokenBalance), user1.address);
    console.log("Difference: %s, Redeem amount: %s, Equal: %s", constants.formatAmount(oldTokenBalance.sub(newTokenBalance)), constants.formatAmount(unwrapAmount), oldTokenBalance.sub(newTokenBalance).eq(unwrapAmount));
}

unwrap()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    })
