const {ethers} = require("hardhat");
const {expect} = require("chai");
const {BigNumber} = require("ethers");
const c = require("./constants.js");

describe("Unwrap", function () {
    let minAmountOwned = ethers.utils.parseUnits("0.01", 8);
    let ownedAmount = ethers.utils.parseUnits("50", 8);
    let minAmountNotOwned = ethers.utils.parseUnits("0.01", 18)
    let notOwnedAmount = ethers.utils.parseUnits("100", 18);

    before(async function () {
        await ethers.provider.send("hardhat_setLoggingEnabled", [false]);
        await c.activateBridgeStep2();
    })

    it("Should not be able to unwrap a token that is not allowed", async function () {
        await expect(c.bridge().connect(c.user1()).unwrap(c.token3().address, notOwnedAmount, c.znnAddress)).
        to.be.revertedWith("unwrap: Token not bridgeable");
    })

    it("Should not be able to unwrap a token that is not bridgeable", async function () {
        await c.setTokenInfo(c.administrator(), c.token3().address, BigNumber.from(100), 15, false, true, false, c.softDelay);

        await expect(c.bridge().connect(c.user1()).unwrap(c.token3().address, notOwnedAmount, c.znnAddress)).
        to.be.revertedWith("unwrap: Token not bridgeable");
    })

    it("Should not be able to unwrap with amount less than minAmount", async function () {
        let amount = minAmountOwned.sub(BigNumber.from(100));
        await expect(c.bridge().connect(c.user1()).unwrap(c.ownedToken1().address, amount, c.znnAddress)).
        to.be.revertedWith("unwrap: Amount has to be greater then the token minAmount");

        amount = minAmountNotOwned.sub(BigNumber.from(1));
        await expect(c.bridge().connect(c.user1()).unwrap(c.notOwnedToken1().address, amount, c.znnAddress)).
        to.be.revertedWith("unwrap: Amount has to be greater then the token minAmount");
    })

    it("Should not be able to unwrap with invalid NoM address length", async function () {
        let address = ""
        await expect(c.bridge().connect(c.user1()).unwrap(c.ownedToken1().address, ownedAmount, address)).
        to.be.revertedWith("unwrap: Invalid NoM address length");

        address = c.znnAddress.substring(0,39)
        await expect(c.bridge().connect(c.user1()).unwrap(c.ownedToken1().address, ownedAmount, address)).
        to.be.revertedWith("unwrap: Invalid NoM address length");

        address = c.znnAddress + "abcdef"
        await expect(c.bridge().connect(c.user1()).unwrap(c.ownedToken1().address, ownedAmount, address)).
        to.be.revertedWith("unwrap: Invalid NoM address length");
    })

    it("Should not be able to unwrap without allowance", async function () {
        await expect(c.bridge().connect(c.user1()).unwrap(c.ownedToken1().address, ownedAmount, c.znnAddress)).
        to.be.revertedWith("BEP20: transfer amount exceeds allowance");

    })

    it("Should not burn a token without rights even if owned is set to true", async function () {
        await c.setTokenInfo(c.administrator(), c.notOwnedToken1().address, BigNumber.from(100), 15, true, true, true, c.softDelay);
        let tokenInfo = await c.bridge().tokensInfo(c.notOwnedToken1().address);
        await expect(tokenInfo.owned)
        let allowanceTx = await c.notOwnedToken1().connect(c.user1()).increaseAllowance(c.bridge().address, notOwnedAmount);
        await allowanceTx.wait();

        let oldBridgeBalance = await c.notOwnedToken1().balanceOf(c.bridge().address);
        let oldUserBalance = await c.notOwnedToken1().balanceOf(c.user1().address);

        let unwrapTx = await c.bridge().connect(c.user1()).unwrap(c.notOwnedToken1().address, notOwnedAmount, c.znnAddress);
        await unwrapTx.wait();

        await expect(await c.notOwnedToken1().balanceOf(c.bridge().address)).to.be.equal(oldBridgeBalance.add(notOwnedAmount));
        await expect(await c.notOwnedToken1().balanceOf(c.user1().address)).to.be.equal(oldUserBalance.sub(notOwnedAmount));
    })

    it("Should revert on calling owner() on an erc20 that does have this functionality", async function () {
        await c.setTokenInfo(c.administrator(), c.wETH().address, BigNumber.from(100), 15, true, true, true, c.softDelay);
        notOwnedAmount = ethers.utils.parseEther("1");
        let allowanceTx = await c.wETH().connect(c.user1()).approve(c.bridge().address, notOwnedAmount);
        await allowanceTx.wait();

        await expect(c.bridge().connect(c.user1()).unwrap(c.wETH().address, notOwnedAmount, c.znnAddress)).
        to.be.revertedWith("unwrap: Owner call failed");
    })
});
