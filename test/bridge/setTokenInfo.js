const { ethers} = require("hardhat");
const { expect } = require("chai");
const {BigNumber} = require("ethers");
const c = require("./constants.js");

describe("SetTokenInfo", function () {
    before(async function () {
        await ethers.provider.send("hardhat_setLoggingEnabled", [false]);
        await c.activateBridgeStep4();
    });

    it("Should fail when calling from non administrator", async function () {
        await expect(c.bridge().connect(c.user1()).setTokenInfo(c.token3().address, BigNumber.from(100), 15, true, true, false)).
            to.be.revertedWith("bridge: Caller not administrator")
    });

    it("Should fail when setting redeemDelay < 3", async function () {
        await expect(c.bridge().connect(c.administrator()).setTokenInfo(c.token3().address, BigNumber.from(100), 2, true, true, false)).
        to.be.revertedWith("setTokenInfo: RedeemDelay is less than minimum")
    });

    it("Should overwrite time challenge when in delay", async function () {
        let setTokenInfoTx = await c.bridge().connect(c.administrator()).setTokenInfo(c.token3().address, BigNumber.from(100), 5, true, true, false)
        await setTokenInfoTx.wait();
        await expect(await c.bridge().timeChallengesInfo("setTokenInfo")).to.deep.equal([
            BigNumber.from(655), "0x7db3c4f588acaf3b9716d78f32f1b1d25b3ac541e5a8a1dc8a2d571298201c5b"
        ]);

        await c.mineBlocks(10);

        setTokenInfoTx = await c.bridge().connect(c.administrator()).setTokenInfo(c.token3().address, BigNumber.from(100), 5, true, true, true)
        await setTokenInfoTx.wait();
        await expect(await c.bridge().timeChallengesInfo("setTokenInfo")).to.deep.equal([
            BigNumber.from(666), "0xf72caa117e8eaa1963e0ed393e1f5eb200d281ef959927bfca3723d08efbec8c"
        ]);

        await expect(await c.bridge().tokensInfo(c.token3().address)).to.deep.equal([
            BigNumber.from(0), BigNumber.from(0), false, false, false
        ]);
    });

    it("Should edit an existing entry", async function () {
        await expect(await c.bridge().tokensInfo(c.ownedToken1().address)).to.deep.equal([
            BigNumber.from(1000000), BigNumber.from(15), true, true, true
        ]);

        await c.setTokenInfo(c.administrator(), c.ownedToken1().address, BigNumber.from(2000000), BigNumber.from(20), false, false, true, c.softDelay);

        await expect(await c.bridge().tokensInfo(c.ownedToken1().address)).to.deep.equal([
            BigNumber.from(2000000), BigNumber.from(20), false, false, true
        ]);
    });
})