const {ethers} = require("hardhat");
const {BigNumber} = require("ethers");
const {expect} = require("chai");
const c = require("./constants.js");

describe("Actions when halted or in unhaltDuration", function ()
{
    let ownedAmount = ethers.utils.parseUnits("50", 8);
    let notOwnedAmount = ethers.utils.parseUnits("100", 18);
    let tssNonce = 0;

    before(async function () {
        await ethers.provider.send("hardhat_setLoggingEnabled", [false]);
        await c.activateBridgeStep4();

        // create the first step of a redeem
        let nonce = BigNumber.from("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab", "hex")
        let signature = await c.getRedeemSignature(c.tss(), c.bridge().address, c.user4().address, c.notOwnedToken2().address, notOwnedAmount, nonce);
        await c.redeemFirstStep(c.user4(), c.user4().address, c.notOwnedToken2().address, notOwnedAmount, nonce, signature);
    })

    beforeEach(async function() {
        await c.halt(c.administrator(), "0x");
    })

    it("Shouldn't be able to unwrap not owned token", async function () {
        await expect(c.bridge().connect(c.user3()).unwrap(c.ownedToken2().address, notOwnedAmount, c.znnAddress)).
        to.be.revertedWith("bridge: Is halted");

        await c.unhalt(c.administrator());
        await c.mineBlocks(10);

        await expect(c.bridge().connect(c.user3()).unwrap(c.ownedToken2().address, notOwnedAmount, c.znnAddress)).
        to.be.revertedWith("bridge: Is halted");
    });

    it("Shouldn't be able to redeem first step", async function () {
        let signature = await c.getRedeemSignature(c.tss(), c.bridge().address, c.user3().address, c.notOwnedToken1().address, notOwnedAmount, tssNonce);
        await expect(c.bridge().connect(c.user3()).redeem(c.user3().address, c.notOwnedToken1().address, notOwnedAmount, tssNonce, signature)).
        to.be.revertedWith("bridge: Is halted");

        await c.unhalt(c.administrator());
        await c.mineBlocks(10);

        await expect(c.bridge().connect(c.user3()).redeem(c.user3().address, c.notOwnedToken1().address, notOwnedAmount, tssNonce, signature)).
        to.be.revertedWith("bridge: Is halted");
    });

    it("Shouldn't be able to redeem second step", async function () {
        let nonce = BigNumber.from("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab", "hex")
        let signature = await c.getRedeemSignature(c.tss(), c.bridge().address, c.user4().address, c.notOwnedToken2().address, notOwnedAmount, nonce);
        await expect(c.bridge().connect(c.user4()).redeem(c.user4().address, c.notOwnedToken2().address, notOwnedAmount, nonce, signature)).
        to.be.revertedWith("bridge: Is halted");

        await c.unhalt(c.administrator());
        await c.mineBlocks(10);

        await expect(c.bridge().connect(c.user4()).redeem(c.user4().address, c.notOwnedToken2().address, notOwnedAmount, nonce, signature)).
        to.be.revertedWith("bridge: Is halted");
    });

    it("Shouldn't be able to unwrap owned token", async function () {
        await expect(c.bridge().connect(c.user1()).unwrap(c.ownedToken1().address, ownedAmount, c.znnAddress)).
        to.be.revertedWith("bridge: Is halted");

        await c.unhalt(c.administrator());
        await c.mineBlocks(10);
        await expect(c.bridge().connect(c.user1()).unwrap(c.ownedToken1().address, ownedAmount, c.znnAddress)).
        to.be.revertedWith("bridge: Is halted");
    });
});
