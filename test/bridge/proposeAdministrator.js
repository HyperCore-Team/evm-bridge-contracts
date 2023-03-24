const {ethers} = require("hardhat");
const {expect} = require("chai");
const c = require("./constants.js");

describe("ProposeAdministrator", function () {
    before(async function () {
        await ethers.provider.send("hardhat_setLoggingEnabled", [false]);
        await c.activateBridgeStep4();
    })

    it("Should revert if calling when non in emergency", async function () {
        await expect(c.bridge().connect(c.user1()).proposeAdministrator(c.ercAdmin().address)).
        to.be.revertedWith("proposeAdministrator: Bridge not in emergency")
    });

    it("Should revert if proposing zero address", async function () {
        await c.emergency(c.administrator());

        await expect(c.bridge().connect(c.user1()).proposeAdministrator(c.zeroAddress)).
        to.be.revertedWith("proposeAdministrator: Invalid new address");
    });

    it("Should not change any votes if calling from non guardian", async function () {
        await c.proposeAdministrator(c.user1(), c.ercAdmin().address);

        await expect(await c.bridge().guardiansVotes(0)).to.deep.equal(c.ercAdmin().address);
        await expect(await c.bridge().guardiansVotes(1)).to.deep.equal(c.zeroAddress);
        await expect(await c.bridge().guardiansVotes(2)).to.deep.equal(c.zeroAddress);
        await expect(await c.bridge().guardiansVotes(3)).to.deep.equal(c.zeroAddress);
        await expect(await c.bridge().guardiansVotes(4)).to.deep.equal(c.zeroAddress);
        await expect(await c.bridge().votesCount(c.ercAdmin().address)).to.be.equal(1);

        await c.proposeAdministrator(c.ercAdmin(), c.ercAdmin().address);

        await expect(await c.bridge().guardiansVotes(0)).to.deep.equal(c.ercAdmin().address);
        await expect(await c.bridge().guardiansVotes(1)).to.deep.equal(c.zeroAddress);
        await expect(await c.bridge().guardiansVotes(2)).to.deep.equal(c.zeroAddress);
        await expect(await c.bridge().guardiansVotes(3)).to.deep.equal(c.zeroAddress);
        await expect(await c.bridge().guardiansVotes(4)).to.deep.equal(c.zeroAddress);
        await expect(await c.bridge().votesCount(c.ercAdmin().address)).to.be.equal(1);
    });

    it("Should not change the voted address and the vote count", async function () {
        await expect(await c.bridge().guardiansVotes(0)).to.deep.equal(c.ercAdmin().address);
        await expect(await c.bridge().votesCount(c.ercAdmin().address)).to.be.equal(1);

        await c.proposeAdministrator(c.user1(), c.user2().address);

        await expect(await c.bridge().guardiansVotes(0)).to.deep.equal(c.user2().address);
        await expect(await c.bridge().votesCount(c.ercAdmin().address)).to.be.equal(0);
        await expect(await c.bridge().votesCount(c.user2().address)).to.be.equal(1);
    });

    it("Should change the administrator on majority and reset votes", async function () {
        await c.proposeAdministrator(c.user1(), c.administrator().address);
        await c.proposeAdministrator(c.user2(), c.administrator().address);
        await expect(await c.bridge().votesCount(c.administrator().address)).to.be.equal(2);

        let proposeAdministratorTx = await c.bridge().connect(c.user3()).proposeAdministrator(c.administrator().address);
        await expect(proposeAdministratorTx).to.emit(c.bridge(), "SetAdministrator").withArgs(c.administrator().address, c.zeroAddress);
        await proposeAdministratorTx.wait();
        await expect(await c.bridge().administrator()).to.deep.equal(c.administrator().address);
        await expect(await c.bridge().votesCount(c.administrator().address)).to.be.equal(0);
        await expect(await c.bridge().guardiansVotes(0)).to.deep.equal(c.zeroAddress);
        await expect(await c.bridge().guardiansVotes(1)).to.deep.equal(c.zeroAddress);
        await expect(await c.bridge().guardiansVotes(2)).to.deep.equal(c.zeroAddress);
        await expect(await c.bridge().guardiansVotes(3)).to.deep.equal(c.zeroAddress);
        await expect(await c.bridge().guardiansVotes(4)).to.deep.equal(c.zeroAddress);
    });
});