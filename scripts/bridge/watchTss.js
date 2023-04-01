require("@nomiclabs/hardhat-ethers");
const { ethers } = require("hardhat");
const publicKeyToAddress = require("ethereum-public-key-to-address");
const constants = require("../constants.js");
const fs = require('fs');
const homedir = require('os').homedir();

async function change() {
    let configPath = homedir + '/.orchestrator/config.json';
    fs.watchFile(configPath, async function (event, filename) {
        let configFile = fs.readFileSync(configPath);
        let configData = JSON.parse(configFile);
        let tssPubKeyB64 = configData.TssConfig.PublicKey;
        console.log(tssPubKeyB64);
        // return;
        const accounts = await hre.ethers.getSigners();
        let owner = accounts[1];
        const bridge = await ethers.getContractAt("Bridge", constants.bridgeAddress);
        let currentTss = await bridge.tss();
        console.log("currentTss", currentTss);
        let tss = publicKeyToAddress(Buffer.from(tssPubKeyB64, 'base64'))
        console.log("new tss", tss);
        if(tss === currentTss) {
            console.log("address didn't change");
            return;
        }
        let setTssGas = await bridge.connect(owner).estimateGas.setTss(tss, "0x")
        let setTssTx = await bridge.connect(owner).setTss(tss, "0x")
        await setTssTx.wait();
        console.log(await bridge.tss());
    });
}

change()
    .catch(error => {
        console.error(error);
        process.exit(1);
    })
