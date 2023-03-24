const {ethers} = require("hardhat");
const {expect} = require("chai");
const c = require("./constants.js");

describe("Setters", function () {
    let softDelay = 18;
    let unhaltDuration = 17;
    let estimatedBlockTime = 7;
    let confirmationsToFinality = 13;

    before(async function () {
        await ethers.provider.send("hardhat_setLoggingEnabled", [false]);
        await c.activateBridgeStep4();
    })

    describe("SetSoftDelay", function () {
        it("Should revert if calling with non admin", async function () {
            await expect(c.bridge().connect(c.user1()).setSoftDelay(softDelay)).
            to.be.revertedWith("bridge: Caller not administrator")
        });

        it("Should revert if calling with value less than min", async function () {
            await expect(c.bridge().connect(c.administrator()).setSoftDelay(14)).
            to.be.revertedWith("setSoftDelay: Delay is less than minimum")
        });

        it("Should set soft delay", async function () {
            await c.setSoftDelay(c.administrator(), softDelay);
        });
    })

    describe("SetUnhaltDuration", function () {
        it("Should revert if calling with non admin", async function () {
            await expect(c.bridge().connect(c.user1()).setUnhaltDuration(unhaltDuration)).
            to.be.revertedWith("bridge: Caller not administrator")
        });

        it("Should revert if calling with value less than min", async function () {
            await expect(c.bridge().connect(c.administrator()).setUnhaltDuration(10)).
            to.be.revertedWith("setUnhaltDuration: Duration is less than minimum")
        });

        it("Should set unhalt duration", async function () {
            await c.setUnhaltDuration(c.administrator(), unhaltDuration);
        });
    })

    describe("SetEstimatedBlockTime", function () {
        it("Should revert if calling with non admin", async function () {
            await expect(c.bridge().connect(c.user1()).setEstimatedBlockTime(estimatedBlockTime)).
            to.be.revertedWith("bridge: Caller not administrator")
        });

        it("Should revert if calling with value less than min", async function () {
            await expect(c.bridge().connect(c.administrator()).setEstimatedBlockTime(0)).
            to.be.revertedWith("setEstimatedBlockTime: BlockTime is less than minimum")
        });

        it("Should set unhalt duration", async function () {
            await c.setEstimatedBlockTime(c.administrator(), estimatedBlockTime);
        });
    })

    describe("SetAllowKeyGen", function () {
        it("Should revert if calling with non admin", async function () {
            await expect(c.bridge().connect(c.user1()).setAllowKeyGen(true)).
            to.be.revertedWith("bridge: Caller not administrator")
        });

        it("Should set allow keyGen true", async function () {
            await c.setAllowKeyGen(c.administrator(), true);
        });

        it("Should set allow keyGen false", async function () {
            await c.setAllowKeyGen(c.administrator(), false);
        });
    })

    describe("SetConfirmationsToFinality", function () {
        it("Should revert if calling with non admin", async function () {
            await expect(c.bridge().connect(c.user1()).setConfirmationsToFinality(confirmationsToFinality)).
            to.be.revertedWith("bridge: Caller not administrator")
        });

        it("Should revert if calling with value less than min", async function () {
            await expect(c.bridge().connect(c.administrator()).setConfirmationsToFinality(1)).
            to.be.revertedWith("setConfirmationsToFinality: Confirmations is less than minimum")
        });

        it("Should set confirmations to finality", async function () {
            await c.setConfirmationsToFinality(c.administrator(), confirmationsToFinality);
        });
    })
})