const {ethers} = require("hardhat");
const {expect} = require("chai");
const c = require("./constants.js");

describe("SetAdministrator", function () {
    before(async function () {
        await ethers.provider.send("hardhat_setLoggingEnabled", [false]);
        await c.activateBridgeStep4();
    })

    it("Should revert if calling with non admin", async function () {
        await expect(c.bridge().connect(c.user1()).setAdministrator(c.ercAdmin().address)).
        to.be.revertedWith("bridge: Caller not administrator")
    });

    it("Should revert if calling with zero address", async function () {
        await expect(c.bridge().connect(c.administrator()).setAdministrator(c.zeroAddress)).
        to.be.revertedWith("setAdministrator: Invalid administrator address")
    });

    it("Should revert if calling when in delay", async function () {
        await c.setAdministratorStep1(c.administrator(), c.ercAdmin().address);

        await c.mineBlocks(15);

        await expect(c.bridge().connect(c.administrator()).setAdministrator(c.ercAdmin().address)).
        to.be.revertedWith("challenge not due")
    });

    it("Should change administrator", async function () {
        await c.mineBlocks(15);
        await c.setAdministratorStep2(c.administrator(), c.ercAdmin().address);
    });
});