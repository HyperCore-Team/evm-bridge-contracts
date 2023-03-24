const { ethers} = require("hardhat");
const c = require("./constants.js");

describe("Bridge", function () {
    it("Should test a complete flow", async function () {
        await ethers.provider.send("hardhat_setLoggingEnabled", [false]);
        await c.activateBridgeStep5();
    });
})