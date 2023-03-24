const {ethers} = require("hardhat");
const {expect} = require("chai");
const c = require("./constants.js");

describe("Halt", function () {
    before(async function () {
        await ethers.provider.send("hardhat_setLoggingEnabled", [false]);
        await c.activateBridgeStep4();
    })

    it("Should revert when calling with non admin and invalid signature length", async function () {
        let signature = "0x";
        await expect(c.bridge().connect(c.user1()).halt(signature)).
        to.be.revertedWith("ECDSA: invalid signature length")
    });

    it("Should revert when calling with non admin and invalid methodName in signature", async function () {
        let actionsNonce = await c.bridge().actionsNonce();
        let signature = c.getHaltSignature(c.tss(), "halt2", c.networkClass, c.chainId, c.bridge().address, actionsNonce);
        await expect(c.bridge().connect(c.user1()).halt(signature)).
        to.be.revertedWith("halt: Wrong signature")
    });

    it("Should revert when calling with non admin and invalid networkClass in signature", async function () {
        let actionsNonce = await c.bridge().actionsNonce();
        let signature = c.getHaltSignature(c.tss(), "setTss", 3, c.chainId, c.bridge().address, actionsNonce);
        await expect(c.bridge().connect(c.user1()).halt(signature)).
        to.be.revertedWith("halt: Wrong signature")
    });

    it("Should revert when calling with non admin and invalid chainId in signature", async function () {
        let actionsNonce = await c.bridge().actionsNonce();
        let signature = c.getHaltSignature(c.tss(), "halt", c.networkClass, 1, c.bridge().address, actionsNonce);
        await expect(c.bridge().connect(c.user1()).halt(signature)).
        to.be.revertedWith("halt: Wrong signature")
    });

    it("Should revert when calling with non admin and invalid bridge address in signature", async function () {
        let actionsNonce = await c.bridge().actionsNonce();
        let signature = c.getHaltSignature(c.tss(), "halt", c.networkClass, c.chainId, c.tss().address, actionsNonce);
        await expect(c.bridge().connect(c.user1()).halt(signature)).
        to.be.revertedWith("halt: Wrong signature")
    });

    it("Should revert when calling with non admin and invalid actions nonce in signature", async function () {
        let actionsNonce = await c.bridge().actionsNonce();
        let signature = c.getHaltSignature(c.tss(), "halt", c.networkClass, c.chainId, c.bridge().address, actionsNonce.add(1));
        await expect(c.bridge().connect(c.user1()).halt(signature)).
        to.be.revertedWith("halt: Wrong signature")
    });

    it("Should revert when calling with non admin and signature from non tss", async function () {
        let actionsNonce = await c.bridge().actionsNonce();
        let signature = c.getHaltSignature(c.ercAdmin(), "halt", c.networkClass, c.chainId, c.bridge().address, actionsNonce.add(1));
        await expect(c.bridge().connect(c.user1()).halt(signature)).
        to.be.revertedWith("halt: Wrong signature")
    });

    it("Should halt with signature", async function() {
        let actionsNonce = await c.bridge().actionsNonce();
        let signature = c.getHaltSignature(c.tss(), "halt", c.networkClass, c.chainId, c.bridge().address, actionsNonce);
        await c.halt(c.user1(), signature);
    })
});