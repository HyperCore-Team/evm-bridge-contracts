require("@nomiclabs/hardhat-ethers");
const { ethers } = require("hardhat");

async function sendBalance() {
    const accounts = await hre.ethers.getSigners();
    let owner = accounts[0];

    let pAddresses = ["0x3Bac6d2Ee87B9BaEF11dD62ee803212532BbE7ee"]

    for (let pAddress of pAddresses) {
        let tx = {
            to: pAddress,
            value: ethers.utils.parseEther("10.0"),
            gasPrice: await ethers.provider.getGasPrice(),
        }
        let sendTx = await owner.sendTransaction(tx);
        await sendTx.wait();
        console.log(await ethers.provider.getBalance(pAddress))
    }

    return 0;
}

sendBalance()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });