const {ethers} = require("hardhat");
const {expect} = require("chai");
const c = require("./constants.js");

describe("Unhalt", function () {
    before(async function () {
        await ethers.provider.send("hardhat_setLoggingEnabled", [false]);
        await c.activateBridgeStep4();
    })

    it("Should revert if calling with non admin", async function () {
        await expect(c.bridge().connect(c.user1()).unhalt()).
        to.be.revertedWith("bridge: Caller not administrator")
    });

    it("Should revert if calling when bridge is not halted", async function () {
        await expect(c.bridge().connect(c.administrator()).unhalt()).
        to.be.revertedWith("unhalt: halted is false")
    });

    it("Should unhalt", async function () {
        await c.halt(c.administrator(), "0x");

        await c.unhalt(c.administrator());
    });
});