const {ethers} = require("hardhat");
const {expect} = require("chai");
const c = require("./constants.js");

describe("NominateGuardians", function () {
    let newGuardians = []

    before(async function () {
        await ethers.provider.send("hardhat_setLoggingEnabled", [false]);
        await c.activateBridgeStep4();
        newGuardians = [c.tss().address, c.user4().address, c.user5().address, c.user1().address, c.ercAdmin().address]
    })

    it("Should revert if calling with non admin", async function () {
        await expect(c.bridge().connect(c.user1()).nominateGuardians(newGuardians)).
        to.be.revertedWith("bridge: Caller not administrator")
    });

    it("Should revert if calling with guardians length less than min", async function () {
        await expect(c.bridge().connect(c.administrator()).nominateGuardians(newGuardians.slice(2,4))).
        to.be.revertedWith("nominateGuardians: Length less than minimum")
    });

    it("Should revert if calling in delay", async function () {
        await c.nominateGuardiansStep1(c.administrator(), newGuardians)

        await c.mineBlocks(10);

        await expect(c.bridge().connect(c.administrator()).nominateGuardians(newGuardians)).
        to.be.revertedWith("challenge not due")
    });

    it("Should change the guardians and guardians votes", async function () {
        await c.mineBlocks(25);

        let currentGuardians = [c.user1().address, c.user2().address, c.user3().address, c.user4().address, c.user5().address]
        // we know we have 5 guardians now
        for (let i = 0; i < 5; i++) {
            await expect(await c.bridge().guardians(i)).to.deep.equal(currentGuardians[i]);
        }
        await c.nominateGuardiansStep2(c.administrator(), newGuardians)
    });

    it("Should revert if calling with duplicates", async function () {
        newGuardians[0] = newGuardians[1]
        await expect(c.bridge().connect(c.administrator()).nominateGuardians(newGuardians)).
        to.be.revertedWith("nominateGuardians: Found duplicated guardian")
    });

    it("Should revert if calling with zero address", async function () {
        newGuardians[0] = c.zeroAddress
        await expect(c.bridge().connect(c.administrator()).nominateGuardians(newGuardians)).
        to.be.revertedWith("nominateGuardians: Found zero address")
    });
});