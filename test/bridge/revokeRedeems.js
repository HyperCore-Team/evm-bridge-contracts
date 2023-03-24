const {ethers} = require("hardhat");
const {expect} = require("chai");
const c = require("./constants.js");

describe("RevokeRedeems", function () {
    before(async function () {
        await ethers.provider.send("hardhat_setLoggingEnabled", [false]);
        await c.activateBridgeStep4();
    })

    it("Should revert if calling with non admin", async function () {
        await expect(c.bridge().connect(c.user1()).revokeRedeems([])).
        to.be.revertedWith("bridge: Caller not administrator")
    });

    it("Should revoke redeems", async function () {
        let redeems = [
            "0xb7fe690d780827a7876fbdbe06d1536cc3da406ab482f11d823fd378291057ff",
            "0x7731592da668d940645d5c8e373d8e7026dc4fb363b259712b00a2a91cd82136",
            "0xcc1cabdfa19473b97b760046608817dc2525404c37ef698da3035082c648d36c",
            "0x33b2d7321a89e9337993778700e046a2460d97a97abf1f97b6204eae22cd79ae",
            "0xb2b61724fcd49570bc75a69a57c2e8562b48ba65bcda0beca362f3e51124d015"
        ]
        await c.revokeRedeems(c.administrator(), redeems);
    });

    it("Should revoke already revoked redeems", async function () {
        let redeems = [
            "0xb7fe690d780827a7876fbdbe06d1536cc3da406ab482f11d823fd378291057ff",
            "0x7731592da668d940645d5c8e373d8e7026dc4fb363b259712b00a2a91cd82136",
            "0xcc1cabdfa19473b97b760046608817dc2525404c37ef698da3035082c648d36c",
            "0x33b2d7321a89e9337993778700e046a2460d97a97abf1f97b6204eae22cd79ae",
            "0xb2b61724fcd49570bc75a69a57c2e8562b48ba65bcda0beca362f3e51124d015"
        ]
        await c.revokeRedeems(c.administrator(), redeems);
    });
});