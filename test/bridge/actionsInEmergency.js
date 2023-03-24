const { ethers} = require("hardhat");
const { expect } = require("chai");
const {BigNumber} = require("ethers");
const c = require("./constants.js");

describe("Actions when in emergency", function () {
    let ownedAmount = ethers.utils.parseUnits("50", 8);
    let notOwnedAmount = ethers.utils.parseUnits("100", 18);
    let nonce = BigNumber.from("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab", "hex")
    let tssNonce = 0;

    before(async function () {
        await ethers.provider.send("hardhat_setLoggingEnabled", [false]);
        await c.activateBridgeStep2()

        // create the first step of a redeem
        let signature = await c.getRedeemSignature(c.tss(), c.bridge().address, c.user4().address, c.notOwnedToken2().address, notOwnedAmount, nonce);
        await c.redeemFirstStep(c.user4(), c.user4().address, c.notOwnedToken2().address, notOwnedAmount, nonce, signature);
        await c.setAllowKeyGen(c.administrator(), true);

        await c.emergency(c.administrator());
        await c.mineBlocks(1);
    })

    it("Shouldn't be able to unwrap owned token", async function () {
        await expect(c.bridge().connect(c.user1()).unwrap(c.ownedToken1().address, ownedAmount, c.znnAddress)).
        to.be.revertedWith("bridge: Is halted");
    });

    it("Shouldn't be able to unwrap not owned token", async function () {
        await expect(c.bridge().connect(c.user3()).unwrap(c.ownedToken2().address, notOwnedAmount, c.znnAddress)).
        to.be.revertedWith("bridge: Is halted");
    });

    it("Shouldn't be able to redeem first step", async function () {
        let signature = await c.getRedeemSignature(c.tss(), c.bridge().address, c.user3().address, c.notOwnedToken1().address, notOwnedAmount, nonce);
        await expect(c.bridge().connect(c.user3()).redeem(c.user3().address, c.notOwnedToken1().address, notOwnedAmount, nonce, signature)).
        to.be.revertedWith("bridge: Is halted");
    });

    it("Shouldn't be able to redeem second step", async function () {
        let signature = await c.getRedeemSignature(c.tss(), c.bridge().address, c.user4().address, c.notOwnedToken2().address, notOwnedAmount, nonce);
        await expect(c.bridge().connect(c.user4()).redeem(c.user4().address, c.notOwnedToken2().address, notOwnedAmount, nonce, signature)).
        to.be.revertedWith("bridge: Is halted");
    });

    it("Shouldn't be able to set tokens info", async function() {
        await expect(c.bridge().connect(c.administrator()).setTokenInfo(c.ownedToken1().address, BigNumber.from(100), c.redeemDelay, false, true, false)).
        to.be.revertedWith("bridge: Caller not administrator");
    });

    it("Shouldn't be able to revoke redeems", async function() {
        await expect(c.bridge().connect(c.administrator()).revokeRedeems([0, 1, 2, 3])).
        to.be.revertedWith("bridge: Caller not administrator");
    });

    it("Shouldn't be able to set administrator", async function() {
        await expect(c.bridge().connect(c.administrator()).setAdministrator(c.tss().address)).
        to.be.revertedWith("bridge: Caller not administrator");
    });

    it("Shouldn't be able to set tss with admin", async function() {
        await expect(c.bridge().connect(c.administrator()).setTss(c.tss().address, "0x", "0x")).
        to.be.revertedWith("setTss: Bridge halted");
    });

    it("Shouldn't be able to set tss with signature", async function() {
        let oldSig = await c.getSetTssSignature(c.tss(), "setTss", c.networkClass, c.chainId, c.bridge().address, tssNonce, c.user5().address)
        let newSig = await c.getSetTssSignature(c.user5(), "setTss", c.networkClass, c.chainId, c.bridge().address, tssNonce, c.user5().address)
        await expect(c.bridge().connect(c.administrator()).setTss(c.user5().address, oldSig, newSig)).
        to.be.revertedWith("setTss: Bridge halted");
    });

    it("Shouldn't be able to call emergency", async function() {
        await expect(c.bridge().connect(c.administrator()).emergency()).
        to.be.revertedWith("bridge: Caller not administrator");
    });

    it("Shouldn't be able to nominate guardians", async function() {
        await expect(c.bridge().connect(c.administrator()).nominateGuardians([c.user1().address, c.user2().address])).
        to.be.revertedWith("bridge: Caller not administrator");
    });

    it("Should be able to propose administrator", async function() {
        await expect(c.bridge().connect(c.user1()).proposeAdministrator(c.administrator().address)).
            not.to.be.reverted;
    });

    it("Should be able to set confirmations to set softDelay", async function() {
        await expect(c.bridge().connect(c.user1()).setSoftDelay(20)).
        to.be.revertedWith("bridge: Caller not administrator");
    });

    it("Should be able to set confirmations to set unhaltDuration", async function() {
        await expect(c.bridge().connect(c.user1()).setUnhaltDuration(20)).
        to.be.revertedWith("bridge: Caller not administrator");
    });

    it("Should be able to set confirmations to set estimatedBlockTime", async function() {
        await expect(c.bridge().connect(c.user1()).setEstimatedBlockTime(20)).
        to.be.revertedWith("bridge: Caller not administrator");
    });

    it("Should be able to set confirmations to set allowKeyGen", async function() {
        await expect(c.bridge().connect(c.user1()).setAllowKeyGen(false)).
        to.be.revertedWith("bridge: Caller not administrator");
    });

    it("Should be able to set confirmationsToFinality", async function() {
        await expect(c.bridge().connect(c.user1()).setConfirmationsToFinality(20)).
        to.be.revertedWith("bridge: Caller not administrator");
    });
});
