require("@nomiclabs/hardhat-ethers");
const { ethers } = require("hardhat");
const publicKeyToAddress = require("ethereum-public-key-to-address");
const constants = require("../constants.js");
const fs = require('fs');
const homedir = require('os').homedir();

async function change() {
    let configPath = homedir + '/.node/config.json';
    fs.watchFile(configPath, async function (event, filename) {
        let configFile = fs.readFileSync(configPath);
        let configData = JSON.parse(configFile);
        let tssPubKeyB64 = configData.TssConfig.PublicKey;
        console.log(tssPubKeyB64);
        // return;
        const accounts = await hre.ethers.getSigners();
        let owner = accounts[1];
        const bridge = await ethers.getContractAt("Bridge", constants.bridgeAddress);
        let currentTssAddress = await bridge.tssAddress();
        console.log("currentTssAddress", currentTssAddress);
        let tssAddress = publicKeyToAddress(Buffer.from(tssPubKeyB64, 'base64'))
        console.log("new tssAddress", tssAddress);
        if(tssAddress == currentTssAddress) {
            console.log("address didn't change");
            return;
        }
        let changeTssGas = await bridge.connect(owner).estimateGas.changeTssAddress(tssAddress, "0x")
        let changeTssTx = await bridge.connect(owner).changeTssAddress(tssAddress, "0x")
        await changeTssTx.wait();
        console.log(await bridge.tssAddress());
    });
}

change()
    .catch(error => {
        console.error(error);
        process.exit(1);
    })
