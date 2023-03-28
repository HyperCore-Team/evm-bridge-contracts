const { ethers} = require("hardhat");
const { expect } = require("chai");
const {BigNumber} = require("ethers");
const c = require("./constants.js");

const {
    defaultAbiCoder: abiCoder,
    arrayify,
    keccak256,
} = ethers.utils;

describe("Redeem", function() {
    let minAmountOwned = ethers.utils.parseUnits("0.01", 8);
    let ownedAmount = ethers.utils.parseUnits("50", 8);
    let minAmountNotOwned = ethers.utils.parseUnits("0.01", 18)
    let notOwnedAmount = ethers.utils.parseUnits("100", 18);
    let nonce = BigNumber.from("0xfaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "hex")

    before(async function () {
        await ethers.provider.send("hardhat_setLoggingEnabled", [false]);
        await c.activateBridgeStep5();

        let nonce = BigNumber.from("0x000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "hex")
        let signature = await c.getRedeemSignature(c.tss(), c.bridge().address, c.user1().address, c.ownedToken1().address, ownedAmount, nonce);
        await c.redeemFirstStep(c.user1(), c.user1().address, c.ownedToken1().address, ownedAmount, nonce, signature)
    })

    it("Should not be able to redeem a token that is not allowed", async function() {

        let signature = await c.getRedeemSignature(c.tss(), c.bridge().address, c.user1().address, c.token3().address, notOwnedAmount, nonce);
        await expect(c.bridge().connect(c.user1()).redeem(c.user1().address, c.token3().address, notOwnedAmount, nonce, signature)).
            to.be.revertedWith("redeem: Token not redeemable");
    });

    it("Should fail to redeem already redeemed entry", async function () {
        let nonce = BigNumber.from("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "hex")
        let signature = await c.getRedeemSignature(c.tss(), c.bridge().address, c.user1().address, c.ownedToken1().address, ownedAmount, nonce);
        await expect(await c.bridge().redeemsInfo(nonce)).to.deep.equal([
            c.uint256Max, "0xb7fe690d780827a7876fbdbe06d1536cc3da406ab482f11d823fd378291057ff"
        ]);
        await expect(c.bridge().connect(c.user1()).redeem(c.user1().address, c.ownedToken1().address, notOwnedAmount, nonce, signature)).
        to.be.revertedWith("redeem: Nonce already redeemed");
    });

    it("Should fail to redeem entry in delay", async function () {
        let nonce = BigNumber.from("0xa0aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "hex")
        let signature = await c.getRedeemSignature(c.tss(), c.bridge().address, c.user1().address, c.ownedToken1().address, ownedAmount, nonce);
        await c.redeemFirstStep(c.user1(), c.user1().address, c.ownedToken1().address, ownedAmount, nonce, signature)

        // redeemDelay is 15
        await c.mineBlocks(10)

        await expect(c.bridge().connect(c.user1()).redeem(c.user1().address, c.ownedToken1().address, ownedAmount, nonce, signature)).
        to.be.revertedWith("redeem: Not redeemable yet");
    });

    it("Should fail with wrong toAddress in signature", async function () {
        let nonce = BigNumber.from("0xa1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "hex")
        let signature = await c.getRedeemSignature(c.tss(), c.bridge().address, c.user1().address, c.ownedToken1().address, ownedAmount, nonce);
        await expect(c.bridge().connect(c.user1()).redeem(c.user2().address, c.ownedToken1().address, ownedAmount, nonce, signature)).
        to.be.revertedWith("redeem: Wrong signature");
    });

    it("Should fail with wrong token in signature", async function () {
        nonce = BigNumber.from("0xa1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "hex")
        let signature = await c.getRedeemSignature(c.tss(), c.bridge().address, c.user1().address, c.ownedToken1().address, ownedAmount, nonce);
        await expect(c.bridge().connect(c.user1()).redeem(c.user1().address, c.ownedToken2().address, ownedAmount, nonce, signature)).
        to.be.revertedWith("redeem: Wrong signature");
    });

    it("Should fail with wrong amount in signature", async function () {
        let signature = await c.getRedeemSignature(c.tss(), c.bridge().address, c.user1().address, c.ownedToken1().address, ownedAmount, nonce);
        await expect(c.bridge().connect(c.user1()).redeem(c.user1().address, c.ownedToken1().address, ownedAmount.add(5 * 1e8), nonce, signature)).
        to.be.revertedWith("redeem: Wrong signature");
    });

    it("Should fail with wrong nonce in signature", async function () {
        let signature = await c.getRedeemSignature(c.tss(), c.bridge().address, c.user1().address, c.ownedToken1().address, ownedAmount, nonce);
        nonce = BigNumber.from("0xa2aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "hex")
        await expect(c.bridge().connect(c.user1()).redeem(c.user1().address, c.ownedToken1().address, ownedAmount, nonce, signature)).
        to.be.revertedWith("redeem: Wrong signature");
    });

    it("Should fail with wrong token in second redeem", async function () {
        let nonce = BigNumber.from("0x000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "hex")
        let signature = await c.getRedeemSignature(c.tss(), c.bridge().address, c.user1().address, c.ownedToken1().address, ownedAmount, nonce);
        await expect(c.bridge().connect(c.user1()).redeem(c.user1().address, c.ownedToken2().address, ownedAmount, nonce, signature)).
        to.be.revertedWith("redeem: Second redeem has different params than the first one");
    });

    it("Should fail with wrong toAddress in second redeem", async function () {
        let nonce = BigNumber.from("0x000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "hex")
        let signature = await c.getRedeemSignature(c.tss(), c.bridge().address, c.user1().address, c.ownedToken1().address, ownedAmount, nonce);
        await expect(c.bridge().connect(c.user1()).redeem(c.user2().address, c.ownedToken1().address, ownedAmount, nonce, signature)).
        to.be.revertedWith("redeem: Second redeem has different params than the first one");
    });

    it("Should fail with wrong amount in second redeem", async function () {
        let nonce = BigNumber.from("0x000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "hex")
        let signature = await c.getRedeemSignature(c.tss(), c.bridge().address, c.user1().address, c.ownedToken1().address, ownedAmount, nonce);
        await expect(c.bridge().connect(c.user1()).redeem(c.user1().address, c.ownedToken1().address, ownedAmount.add(5 * 1e8), nonce, signature)).
        to.be.revertedWith("redeem: Second redeem has different params than the first one");
    });

    it("Should not be able to redeem a token that is not redeemable", async function() {
        await c.setTokenInfo(c.administrator(), c.ownedToken1().address, minAmountOwned, c.redeemDelay, true, false, true, c.softDelay);
        let signature = await c.getRedeemSignature(c.tss(), c.bridge().address, c.user1().address, c.ownedToken1().address, notOwnedAmount, nonce);
        await expect(c.bridge().connect(c.user1()).redeem(c.user1().address, c.ownedToken1().address, notOwnedAmount, nonce, signature)).
        to.be.revertedWith("redeem: Token not redeemable");
    });

    it("Should not redeem and mint a token without rights even if owned is set to true", async function () {
        await c.setTokenInfo(c.administrator(), c.notOwnedToken1().address, BigNumber.from(100), 15, true, true, true, c.softDelay);
        let tokenInfo = await c.bridge().tokensInfo(c.notOwnedToken1().address);
        await expect(tokenInfo.owned)

        let signature = await c.getRedeemSignature(c.tss(), c.bridge().address, c.user1().address, c.notOwnedToken1().address, notOwnedAmount, nonce);
        let redeemTx = await c.bridge().connect(c.user1()).redeem(c.user1().address, c.notOwnedToken1().address, notOwnedAmount, nonce, signature);
        await redeemTx.wait();

        await c.mineBlocks(16);
        await expect(c.bridge().connect(c.user1()).redeem(c.user1().address, c.notOwnedToken1().address, notOwnedAmount, nonce, signature)).
        to.be.revertedWith("redeem: mint call failed");

    })
});