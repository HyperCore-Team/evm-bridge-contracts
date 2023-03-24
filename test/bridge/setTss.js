const {ethers} = require("hardhat");
const {expect} = require("chai");
const c = require("./constants.js");
const {ercAdmin} = require("./constants");

describe("SetTss", function () {
    let oldSignature, newSignature;
    let actionsNonce;
    before(async function () {
        await ethers.provider.send("hardhat_setLoggingEnabled", [false]);
        await c.activateBridgeStep4();
        actionsNonce = await c.bridge().actionsNonce();
        newSignature = await c.getSetTssSignature(c.tss(), "setTss", c.networkClass, c.chainId, c.bridge().address, actionsNonce, c.ercAdmin().address);
    })

    it("Should revert when calling with non admin keyGen is false", async function() {
        oldSignature = await c.getSetTssSignature(c.tss(), "setTss", c.networkClass, c.chainId, c.bridge().address, actionsNonce, c.ercAdmin().address);
        await expect(c.bridge().connect(c.user1()).setTss(c.ercAdmin().address, oldSignature, newSignature)).
        to.be.revertedWith("setTss: KeyGen is not allowed")
    });

    it("Should revert when calling with non admin and invalid methodName in old signature", async function() {
        await c.setAllowKeyGen(c.administrator(), true);

        oldSignature = await c.getSetTssSignature(c.tss(), "setTss2", c.networkClass, c.chainId, c.bridge().address, actionsNonce, c.ercAdmin().address);
        await expect(c.bridge().connect(c.user1()).setTss(c.ercAdmin().address, oldSignature, newSignature)).
        to.be.revertedWith("setTss: Wrong old signature")
    });

    it("Should revert when calling with non admin and invalid networkClass in old signature", async function() {
        oldSignature = await c.getSetTssSignature(c.tss(), "setTss", 3, c.chainId, c.bridge().address, actionsNonce, c.ercAdmin().address);
        await expect(c.bridge().connect(c.user1()).setTss(c.ercAdmin().address, oldSignature, newSignature)).
        to.be.revertedWith("setTss: Wrong old signature")
    });

    it("Should revert when calling with non admin and invalid chainId in old signature", async function() {
        oldSignature = await  c.getSetTssSignature(c.tss(), "setTss", c.networkClass, 1, c.bridge().address, actionsNonce, c.ercAdmin().address);
        await expect(c.bridge().connect(c.user1()).setTss(c.ercAdmin().address, oldSignature, newSignature)).
        to.be.revertedWith("setTss: Wrong old signature")
    });

    it("Should revert when calling with non admin and invalid bridge address in old signature", async function() {
        oldSignature = await c.getSetTssSignature(c.tss(), "setTss", c.networkClass, c.chainId, c.tss().address, actionsNonce, c.ercAdmin().address);
        await expect(c.bridge().connect(c.user1()).setTss(c.ercAdmin().address, oldSignature, newSignature)).
        to.be.revertedWith("setTss: Wrong old signature")
    });

    it("Should revert when calling with non admin and invalid actions nonce in old signature", async function() {
        oldSignature = await c.getSetTssSignature(c.tss(), "setTss", c.networkClass, c.chainId, c.bridge().address, actionsNonce.add(1), c.ercAdmin().address);
        await expect(c.bridge().connect(c.user1()).setTss(c.ercAdmin().address, oldSignature, newSignature)).
        to.be.revertedWith("setTss: Wrong old signature")
    });

    it("Should revert when calling with non admin and old signature from non tss", async function() {
        oldSignature = await c.getSetTssSignature(c.ercAdmin(), "setTss", c.networkClass, c.chainId, c.bridge().address, actionsNonce, c.ercAdmin().address);
        await expect(c.bridge().connect(c.user1()).setTss(c.ercAdmin().address, oldSignature, newSignature)).
        to.be.revertedWith("setTss: Wrong old signature")
    });

    it("Should revert when calling with non admin and invalid methodName in new signature", async function() {
        oldSignature = await c.getSetTssSignature(c.tss(), "setTss", c.networkClass, c.chainId, c.bridge().address, actionsNonce, c.ercAdmin().address);
        newSignature = await c.getSetTssSignature(c.tss(), "setTss2", c.networkClass, c.chainId, c.bridge().address, actionsNonce, c.ercAdmin().address);
        await expect(c.bridge().connect(c.user1()).setTss(c.ercAdmin().address, oldSignature, newSignature)).
        to.be.revertedWith("setTss: Wrong new signature")
    });

    it("Should revert when calling with non admin and invalid networkClass in new signature", async function() {
        newSignature = await c.getSetTssSignature(c.tss(), "setTss", 3, c.chainId, c.bridge().address, actionsNonce, c.ercAdmin().address);
        await expect(c.bridge().connect(c.user1()).setTss(c.ercAdmin().address, oldSignature, newSignature)).
        to.be.revertedWith("setTss: Wrong new signature")
    });

    it("Should revert when calling with non admin and invalid chainId in new signature", async function() {
        newSignature = await  c.getSetTssSignature(c.tss(), "setTss", c.networkClass, 1, c.bridge().address, actionsNonce, c.ercAdmin().address);
        await expect(c.bridge().connect(c.user1()).setTss(c.ercAdmin().address, oldSignature, newSignature)).
        to.be.revertedWith("setTss: Wrong new signature")
    });

    it("Should revert when calling with non admin and invalid bridge address in new signature", async function() {
        newSignature = await c.getSetTssSignature(c.tss(), "setTss", c.networkClass, c.chainId, c.tss().address, actionsNonce, c.ercAdmin().address);
        await expect(c.bridge().connect(c.user1()).setTss(c.ercAdmin().address, oldSignature, newSignature)).
        to.be.revertedWith("setTss: Wrong new signature")
    });

    it("Should revert when calling with non admin and invalid actions nonce in new signature", async function() {
        newSignature = await c.getSetTssSignature(c.tss(), "setTss", c.networkClass, c.chainId, c.bridge().address, actionsNonce.add(1), c.ercAdmin().address);
        await expect(c.bridge().connect(c.user1()).setTss(c.ercAdmin().address, oldSignature, newSignature)).
        to.be.revertedWith("setTss: Wrong new signature")
    });

    it("Should revert when calling with non admin and new signature from non tss", async function() {
        newSignature = await c.getSetTssSignature(c.user1(), "setTss", c.networkClass, c.chainId, c.bridge().address, actionsNonce, c.ercAdmin().address);
        await expect(c.bridge().connect(c.user1()).setTss(c.ercAdmin().address, oldSignature, newSignature)).
        to.be.revertedWith("setTss: Wrong new signature")
    });

    it("Should change tss with valid signatures", async function() {
        newSignature = await c.getSetTssSignature(c.ercAdmin(), "setTss", c.networkClass, c.chainId, c.bridge().address, actionsNonce, c.ercAdmin().address);
        await c.setTssWithSignature(c.user1(), c.ercAdmin().address, oldSignature, newSignature);
    })

    it("Should revert if calling when in delay by admin", async function() {
        await c.setTssStep1(c.administrator(), c.tss().address, "0x", "0x");

        await c.mineBlocks(14);

        await expect(c.bridge().connect(c.administrator()).setTss(c.tss().address, "0x", "0x")).
        to.be.revertedWith("challenge not due");
    })

    it("Should change tss with admin", async function() {
        await c.mineBlocks(5);
        await c.setTssStep2(c.administrator(), c.tss().address, "0x", "0x");
    })

    it("Should revert if calling with zero address by admin", async function() {
        await expect(c.bridge().connect(c.administrator()).setTss(c.zeroAddress, "0x", "0x")).
        to.be.revertedWith("setTss: Invalid newTss");
    })

    it("Should revert if calling with zero address with signatures", async function() {
        actionsNonce = await c.bridge().actionsNonce();
        oldSignature = await c.getSetTssSignature(c.tss(), "setTss", c.networkClass, c.chainId, c.bridge().address, actionsNonce, c.ercAdmin().address);
        newSignature = await c.getSetTssSignature(c.tss(), "setTss", c.networkClass, c.chainId, c.bridge().address, actionsNonce, c.ercAdmin().address);
        await expect(c.bridge().connect(c.administrator()).setTss(c.zeroAddress, oldSignature, newSignature)).
        to.be.revertedWith("setTss: Invalid newTss");
    })
});