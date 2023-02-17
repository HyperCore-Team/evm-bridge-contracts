const { ethers } = require("hardhat")

module.exports = {
    wZNNAddress: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    wQSRAddress: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    wZnnLP: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
    wQsrLP: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
    bridgeAddress: "0x8464135c8F25Da09e49BC8782676a84730C318bC",

    derivationPathPrefix: "m/44\'/60\'/0\'/",

    formatAmount: function formatAmount(amount) {
        return ethers.utils.formatUnits(amount, 8);
    },
    parseAmount: function parseAmount(amount) {
        return ethers.utils.parseUnits(amount, 8);
    },

    printBalance: async function printBalance(address) {
        var balance = await ethers.provider.getBalance(address);
        console.log("BNB balance %d for address %s", ethers.utils.formatEther(balance), address);
        return balance
    },

    sleep: function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
