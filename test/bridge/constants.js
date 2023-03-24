const { ethers } = require("hardhat")
const {expect} = require("chai");
const {BigNumber} = require("ethers");
const {
    defaultAbiCoder: abiCoder,
    arrayify,
    keccak256,
} = ethers.utils;

let bridge, ownedToken1, ownedToken2, notOwnedToken1, notOwnedToken2, wETH, token3
let administrator, tss, ercAdmin;
let user1, user2, user3, user4, user5;

const networkClass = 2
const chainId = 31337
const zeroAddress = "0x" + "0".repeat(40)
const zeroAmountBig = ethers.utils.parseUnits("0", 0)
const uint256Max = ethers.utils.parseUnits("115792089237316195423570985008687907853269984665640564039457584007913129639935", 0)
const znnAddress = "z1q" + "a".repeat(37)
const unhaltDuration = 15
const administratorDelay = 30
const softDelay = 15
const redeemDelay = 15
const redeemDelayBig = ethers.utils.parseUnits("15", 0)
const blockTime = 4
const confirmationsToFinality= 11


// deploy bridge and 5 tokens + wETH
async function activateBridgeStep0() {
    await ethers.provider.send("hardhat_reset")

    await mineHack(500)
    // 100 ms
    await ethers.provider.send("evm_setIntervalMining", [100]);

    let tokenFactory = await ethers.getContractFactory("BEP20Token");
    let bridgeFactory = await ethers.getContractFactory("Bridge");
    [administrator, tss, ercAdmin, user1, user2, user3, user4, user5] = await ethers.getSigners();

    // deploy bridge
    bridge = await bridgeFactory.connect(administrator).deploy(unhaltDuration, administratorDelay, softDelay, blockTime,
        confirmationsToFinality, [user1.address, user2.address, user3.address, user4.address, user5.address]);
    // deploy owned tokens and it's owner has to be the bridge address
    ownedToken1 = await tokenFactory.connect(ercAdmin).deploy("wrapped ZNN", "wZNN", 8, true, bridge.address);
    expect(await ownedToken1.owner()).to.be.equal(bridge.address);
    ownedToken2 = await tokenFactory.connect(ercAdmin).deploy("wrapped QSR", "wQSR", 8, true, bridge.address);
    expect(await ownedToken2.owner()).to.be.equal(bridge.address);

    // deploy non owned token and distribute some funds
    notOwnedToken1 = await tokenFactory.connect(ercAdmin).deploy("test Token1", "tst1", 18, false, bridge.address);

    let amount = ethers.utils.parseUnits("5000", 18);
    let sendTx = await notOwnedToken1.connect(ercAdmin).transfer(bridge.address, amount);
    await sendTx.wait();
    expect(await notOwnedToken1.balanceOf(bridge.address)).to.be.equal(amount);

    notOwnedToken2 = await tokenFactory.connect(ercAdmin).deploy("test Token2", "tst2", 18, false, bridge.address);

    sendTx = await notOwnedToken2.connect(ercAdmin).transfer(bridge.address, amount);
    await sendTx.wait();
    expect(await notOwnedToken2.balanceOf(bridge.address)).to.be.equal(amount);

    let wETH9Factory = await ethers.getContractFactory("WETH9");
    wETH = await wETH9Factory.connect(ercAdmin).deploy();

    let wEthAmount = ethers.utils.parseEther("10");
    let depositTx = await wETH.connect(user1).deposit({value: wEthAmount});
    await depositTx.wait();
    expect(await wETH.balanceOf(user1.address)).to.be.equal(wEthAmount);

    depositTx = await wETH.connect(user2).deposit({value: wEthAmount});
    await depositTx.wait();
    expect(await wETH.balanceOf(user2.address)).to.be.equal(wEthAmount);

    depositTx = await wETH.connect(user3).deposit({value: wEthAmount});
    await depositTx.wait();
    expect(await wETH.balanceOf(user3.address)).to.be.equal(wEthAmount);

    tokenFactory = await ethers.getContractFactory("BEP20Token");
    token3 = await tokenFactory.connect(user1).deploy("test Token3", "tst3", 18, false, bridge.address);
}

// deploy bridge and 4 tokens + wETH
// set tss
async function activateBridgeStep1() {
    await activateBridgeStep0();

    expect(await bridge.tss()).to.be.equal(zeroAddress);
    await setTssWithAdmin(administrator, tss.address, "0x", "0x", administratorDelay);
    expect(await bridge.tss()).to.be.equal(tss.address);
}

// deploy bridge and 4 tokens + wETH
// set tss
// set tokensInfo
async function activateBridgeStep2() {
    await activateBridgeStep1();

    let minAmountOwned = ethers.utils.parseUnits("0.01", 8);
    await setTokenInfo(administrator, ownedToken1.address, minAmountOwned, redeemDelay, true, true, true, softDelay);
    expect(await bridge.tokensInfo(ownedToken1.address)).to.deep.equal([
        minAmountOwned, redeemDelayBig, true, true, true
    ]);

    await setTokenInfo(administrator, ownedToken2.address, minAmountOwned, redeemDelay, true, true, true, softDelay);
    expect(await bridge.tokensInfo(ownedToken2.address)).to.deep.equal([
        minAmountOwned, redeemDelayBig, true, true, true]
    );

    let minAmountNotOwned = ethers.utils.parseUnits("0.01", 18)
    await setTokenInfo(administrator, notOwnedToken1.address, minAmountNotOwned, redeemDelay, true, true, false, softDelay);
    expect(await bridge.tokensInfo(notOwnedToken1.address)).to.deep.equal([
        minAmountNotOwned, redeemDelayBig, true, true, false]
    );

    await setTokenInfo(administrator, notOwnedToken2.address, minAmountNotOwned, redeemDelay, true, true, false, softDelay);
    expect(await bridge.tokensInfo(notOwnedToken2.address)).to.deep.equal([
        minAmountNotOwned, redeemDelayBig, true, true, false]
    );

    await setTokenInfo(administrator, wETH.address, minAmountNotOwned, redeemDelay, true, true, false, softDelay);
    expect(await bridge.tokensInfo(wETH.address)).to.deep.equal([
        minAmountNotOwned, redeemDelayBig, true, true, false]
    );
}

// deploy bridge and 4 tokens + wETH
// set tss
// set tokensInfo
// create 5 swaps one for each token
async function activateBridgeStep3() {
    await activateBridgeStep2();

    let ownedAmount = ethers.utils.parseUnits("10", 8);
    let allowanceTx = await ownedToken1.connect(user1).increaseAllowance(bridge.address, ownedAmount);
    await allowanceTx.wait();

    expect(await ownedToken1.balanceOf(bridge.address)).to.be.equal(zeroAmountBig);
    await unwrap(user1, ownedToken1.address, ownedAmount, znnAddress)
    expect(await ownedToken1.balanceOf(bridge.address)).to.be.equal(zeroAmountBig);

    // ------------------------------------

    allowanceTx = await ownedToken2.connect(user1).increaseAllowance(bridge.address, ownedAmount);
    await allowanceTx.wait();

    expect(await ownedToken2.balanceOf(bridge.address)).to.be.equal(zeroAmountBig);
    await unwrap(user1, ownedToken2.address, ownedAmount, znnAddress)
    expect(await ownedToken2.balanceOf(bridge.address)).to.be.equal(zeroAmountBig);

    // ------------------------------------

    let notOwnedAmount = ethers.utils.parseUnits("50", 18);
    allowanceTx = await notOwnedToken1.connect(user1).increaseAllowance(bridge.address, notOwnedAmount);
    await allowanceTx.wait();

    let balanceToken1 = await notOwnedToken1.balanceOf(bridge.address);
    await unwrap(user1, notOwnedToken1.address, notOwnedAmount, znnAddress)
    expect(await notOwnedToken1.balanceOf(bridge.address)).to.be.equal(balanceToken1.add(notOwnedAmount));

    // ------------------------------------

    allowanceTx = await notOwnedToken2.connect(user1).increaseAllowance(bridge.address, notOwnedAmount);
    await allowanceTx.wait();

    let balanceToken2 = await notOwnedToken2.balanceOf(bridge.address);
    await unwrap(user1, notOwnedToken2.address, notOwnedAmount, znnAddress)
    expect(await notOwnedToken2.balanceOf(bridge.address)).to.be.equal(balanceToken2.add(notOwnedAmount));

    // ------------------------------------
    notOwnedAmount = ethers.utils.parseUnits("5", 18);
    allowanceTx = await wETH.connect(user3).approve(bridge.address, notOwnedAmount);
    await allowanceTx.wait();

    let balanceWETH = await wETH.balanceOf(bridge.address);
    await unwrap(user3, wETH.address, notOwnedAmount, znnAddress)
    expect(await wETH.balanceOf(bridge.address)).to.be.equal(balanceWETH.add(notOwnedAmount));
}

// deploy bridge and 4 tokens + wETH
// set tss
// set tokensInfo
// create 5 swaps one for each token
// create the first step for 5 redeems
async function activateBridgeStep4() {
    await activateBridgeStep3();

    let ownedAmount = ethers.utils.parseUnits("50", 8);
    let nonce = BigNumber.from("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "hex")
    let signature = await getRedeemSignature(tss, bridge.address, user1.address, ownedToken1.address, ownedAmount, nonce);
    await redeemFirstStep(user1, user1.address, ownedToken1.address, ownedAmount, nonce, signature);
    await expect(await bridge.redeemsInfo(nonce)).to.deep.equal([
        BigNumber.from(647), "0xb7fe690d780827a7876fbdbe06d1536cc3da406ab482f11d823fd378291057ff"
    ]);

    nonce = BigNumber.from("0xbaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "hex")
    signature = await getRedeemSignature(tss, bridge.address, user2.address, ownedToken2.address, ownedAmount, nonce);
    await redeemFirstStep(user2, user2.address, ownedToken2.address, ownedAmount, nonce, signature);
    await expect(await bridge.redeemsInfo(nonce)).to.deep.equal([
        BigNumber.from(648), "0x7731592da668d940645d5c8e373d8e7026dc4fb363b259712b00a2a91cd82136"
    ]);

    nonce = BigNumber.from("0xcaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "hex")
    let notOwnedAmount = ethers.utils.parseUnits("100", 18);
    signature = await getRedeemSignature(tss, bridge.address, user3.address, notOwnedToken1.address, notOwnedAmount, nonce);
    await redeemFirstStep(user3, user3.address, notOwnedToken1.address, notOwnedAmount, nonce, signature);
    await expect(await bridge.redeemsInfo(nonce)).to.deep.equal([
        BigNumber.from(649), "0xcc1cabdfa19473b97b760046608817dc2525404c37ef698da3035082c648d36c"
    ]);

    nonce = BigNumber.from("0xdaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "hex")
    signature = await getRedeemSignature(tss, bridge.address, user4.address, notOwnedToken2.address, notOwnedAmount, nonce);
    await redeemFirstStep(user4, user4.address, notOwnedToken2.address, notOwnedAmount, nonce, signature);
    await expect(await bridge.redeemsInfo(nonce)).to.deep.equal([
        BigNumber.from(650), "0x33b2d7321a89e9337993778700e046a2460d97a97abf1f97b6204eae22cd79ae"
    ]);

    notOwnedAmount = ethers.utils.parseUnits("1", 18);
    nonce = BigNumber.from("0xeaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "hex")
    signature = await getRedeemSignature(tss, bridge.address, user1.address, wETH.address, notOwnedAmount, nonce);
    await redeemFirstStep(user1, user1.address, wETH.address, notOwnedAmount, nonce, signature);
    await expect(await bridge.redeemsInfo(nonce)).to.deep.equal([
        BigNumber.from(651), "0xb2b61724fcd49570bc75a69a57c2e8562b48ba65bcda0beca362f3e51124d015"
    ]);
}

// deploy bridge and 4 tokens + wETH
// set tss
// set tokensInfo
// create 5 swaps one for each token
// create the first step for 5 redeems
// redeem the 5 requests
async function activateBridgeStep5() {
    await activateBridgeStep4();

    await mineBlocks(redeemDelay);

    let ownedAmount = ethers.utils.parseUnits("50", 8);
    let oldBridgeBalance = await ownedToken1.balanceOf(bridge.address);
    let oldUserBalance = await ownedToken1.balanceOf(user1.address);
    let nonce = BigNumber.from("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "hex")
    let signature = await getRedeemSignature(tss, bridge.address, user1.address, ownedToken1.address, ownedAmount, nonce);
    await redeemSecondStep(user1, user1.address, ownedToken1.address, ownedAmount, nonce, signature);
    await expect(await bridge.redeemsInfo(nonce)).to.deep.equal([
        uint256Max, "0xb7fe690d780827a7876fbdbe06d1536cc3da406ab482f11d823fd378291057ff"
    ]);
    await expect(await ownedToken1.balanceOf(bridge.address)).to.be.equal(oldBridgeBalance);
    await expect(await ownedToken1.balanceOf(user1.address)).to.be.equal(oldUserBalance.add(ownedAmount));

    oldBridgeBalance = await ownedToken2.balanceOf(bridge.address);
    oldUserBalance = await ownedToken2.balanceOf(user2.address);
    nonce = BigNumber.from("0xbaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "hex")
    signature = await getRedeemSignature(tss, bridge.address, user2.address, ownedToken2.address, ownedAmount, nonce);
    await redeemSecondStep(user1, user2.address, ownedToken2.address, ownedAmount, nonce, signature);
    await expect(await bridge.redeemsInfo(nonce)).to.deep.equal([
        uint256Max, "0x7731592da668d940645d5c8e373d8e7026dc4fb363b259712b00a2a91cd82136"
    ]);
    await expect(await ownedToken2.balanceOf(bridge.address)).to.be.equal(oldBridgeBalance);
    await expect(await ownedToken2.balanceOf(user2.address)).to.be.equal(oldUserBalance.add(ownedAmount));

    let notOwnedAmount = ethers.utils.parseUnits("100", 18);
    oldBridgeBalance = await notOwnedToken1.balanceOf(bridge.address);
    oldUserBalance = await notOwnedToken1.balanceOf(user3.address);
    nonce = BigNumber.from("0xcaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "hex")
    signature = await getRedeemSignature(tss, bridge.address, user3.address, notOwnedToken1.address, notOwnedAmount, nonce);
    await redeemSecondStep(user3, user3.address, notOwnedToken1.address, notOwnedAmount, nonce, signature);
    await expect(await bridge.redeemsInfo(nonce)).to.deep.equal([
        uint256Max, "0xcc1cabdfa19473b97b760046608817dc2525404c37ef698da3035082c648d36c"
    ]);
    await expect(await notOwnedToken1.balanceOf(bridge.address)).to.be.equal(oldBridgeBalance.sub(notOwnedAmount));
    await expect(await notOwnedToken1.balanceOf(user3.address)).to.be.equal(oldUserBalance.add(notOwnedAmount));

    oldBridgeBalance = await notOwnedToken2.balanceOf(bridge.address);
    oldUserBalance = await notOwnedToken2.balanceOf(user4.address);
    nonce = BigNumber.from("0xdaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "hex")
    signature = await getRedeemSignature(tss, bridge.address, user4.address, notOwnedToken2.address, notOwnedAmount, nonce);
    await redeemSecondStep(user4, user4.address, notOwnedToken2.address, notOwnedAmount, nonce, signature);
    await expect(await bridge.redeemsInfo(nonce)).to.deep.equal([
        uint256Max, "0x33b2d7321a89e9337993778700e046a2460d97a97abf1f97b6204eae22cd79ae"
    ]);
    await expect(await notOwnedToken2.balanceOf(bridge.address)).to.be.equal(oldBridgeBalance.sub(notOwnedAmount));
    await expect(await notOwnedToken2.balanceOf(user4.address)).to.be.equal(oldUserBalance.add(notOwnedAmount));

    oldBridgeBalance = await wETH.balanceOf(bridge.address);
    oldUserBalance = await wETH.balanceOf(user1.address);
    notOwnedAmount = ethers.utils.parseUnits("1", 18);
    nonce = BigNumber.from("0xeaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "hex")
    signature = await getRedeemSignature(tss, bridge.address, user1.address, wETH.address, notOwnedAmount, nonce);
    await redeemSecondStep(user1, user1.address, wETH.address, notOwnedAmount, nonce, signature);
    await expect(await bridge.redeemsInfo(nonce)).to.deep.equal([
        uint256Max, "0xb2b61724fcd49570bc75a69a57c2e8562b48ba65bcda0beca362f3e51124d015"
    ]);
    await expect(await wETH.balanceOf(bridge.address)).to.be.equal(oldBridgeBalance.sub(notOwnedAmount));
    await expect(await wETH.balanceOf(user1.address)).to.be.equal(oldUserBalance.add(notOwnedAmount));
}

async function setTokenInfoStep1(administrator, token, minAmount, redeemDelay, bridgeable, redeemable, owned) {
    let setTokensInfoTx = await bridge.connect(administrator).setTokenInfo(token, minAmount, redeemDelay, bridgeable, redeemable, owned);
    await expect(setTokensInfoTx).to.emit(bridge, "PendingTokenInfo").withArgs(token);
    await setTokensInfoTx.wait();
}

async function setTokenInfoStep2(administrator, token, minAmount, redeemDelay, bridgeable, redeemable, owned) {
    let setTokensInfoTx = await bridge.connect(administrator).setTokenInfo(token, minAmount, redeemDelay, bridgeable, redeemable, owned);
    await expect(setTokensInfoTx).to.emit(bridge, "SetTokenInfo").withArgs(token);
    await setTokensInfoTx.wait();
}

async function setTokenInfo(administrator, token, minAmount, redeemDelay, bridgeable, redeemable, owned, delay) {
    await setTokenInfoStep1(administrator, token, minAmount, redeemDelay, bridgeable, redeemable, owned);
    await mineBlocks(delay + 1);
    await setTokenInfoStep2(administrator, token, minAmount, redeemDelay, bridgeable, redeemable, owned);
}

async function setTssStep1(user, newTss, oldSignature, newSignature) {
    let setTssTx = await bridge.connect(user).setTss(newTss, oldSignature, newSignature);
    await expect(setTssTx).to.emit(bridge, "PendingTss").withArgs(newTss);
    await setTssTx.wait();
}

async function setTssStep2(user, newTss, oldSignature, newSignature) {
    let oldTss = await bridge.tss();
    let setTssTx = await bridge.connect(user).setTss(newTss, oldSignature, newSignature);
    await expect(setTssTx).to.emit(bridge, "SetTss").withArgs(newTss, oldTss);
    await setTssTx.wait();
    await expect(await bridge.tss()).to.deep.equal(newTss);
}

async function setTssWithAdmin(administrator, newTss, oldSignature, newSignature, delay) {
    await setTssStep1(administrator, newTss, oldSignature, newSignature);
    await mineBlocks(delay + 1);
    await setTssStep2(administrator, newTss, oldSignature, newSignature);
}

async function setTssWithSignature(user, newTss, oldSignature, newSignature) {
    let oldTss = await bridge.tss();
    let setTssTx = await bridge.connect(user).setTss(newTss, oldSignature, newSignature);
    await expect(setTssTx).to.emit(bridge, "SetTss").withArgs(newTss, oldTss);
    await setTssTx.wait();
    await expect(await bridge.tss()).to.deep.equal(newTss);
}

async function unwrap(user, token, amount, to) {
    let unwrapTx = await bridge.connect(user).unwrap(token, amount, to);
    await expect(unwrapTx).to.emit(bridge, "Unwrapped").withArgs(user.address, token, znnAddress, amount);
    await unwrapTx.wait();
}

async function halt(user, signature) {
    let haltTx = await bridge.connect(user).halt(signature);
    await expect(haltTx).to.emit(bridge, "Halted").withArgs();
    await haltTx.wait();
    await expect(await bridge.halted()).to.be.equal(true);
}

async function revokeRedeems(administrator, redeems) {
    let revokeRedeemsTx = await bridge.connect(administrator).revokeRedeems(redeems);
    for (let i = 0; i < redeems.length; i++) {
        await expect(revokeRedeemsTx).to.emit(bridge, "RevokedRedeem").withArgs(redeems[i]);
        let redeemInfo = await bridge.redeemsInfo(redeems[i]);
        await expect(redeemInfo.blockNumber).to.be.equal(uint256Max);
    }
    await revokeRedeemsTx.wait();
}

async function nominateGuardiansStep1(administrator, guardians) {
    let nominateGuardiansTx = await bridge.connect(administrator).nominateGuardians(guardians);
    await expect(nominateGuardiansTx).to.emit(bridge, "PendingGuardians");
    await nominateGuardiansTx.wait();
}

async function nominateGuardiansStep2(administrator, guardians) {
    let nominateGuardiansTx = await bridge.connect(administrator).nominateGuardians(guardians);
    await expect(nominateGuardiansTx).to.emit(bridge, "SetGuardians");
    await nominateGuardiansTx.wait();
    for (let i = 0; i < guardians.length; i++) {
        await expect(await bridge.guardians(i)).to.deep.equal(guardians[i]);
        await expect(await bridge.guardiansVotes(i)).to.deep.equal(zeroAddress);
    }
}

async function nominateGuardians(administrator, guardians, delay) {
    await nominateGuardiansStep1(administrator, guardians)

    await mineBlocks(delay + 1)

    await nominateGuardiansStep2(administrator, guardians)
}

async function setAdministratorStep1(administrator, newAministrator) {
    let proposeAdministratorTx = await bridge.connect(administrator).setAdministrator(newAministrator);
    await expect(proposeAdministratorTx).to.emit(bridge, "PendingAdministrator").withArgs(newAministrator);
    await proposeAdministratorTx.wait();
}

async function setAdministratorStep2(administrator, newAministrator) {
    let proposeAdministratorTx = await bridge.connect(administrator).setAdministrator(newAministrator);
    await expect(proposeAdministratorTx).to.emit(bridge, "SetAdministrator").withArgs(newAministrator, administrator.address);
    await proposeAdministratorTx.wait();
}

async function setAdministrator(administrator, newAministrator, delay) {
    await setAdministratorStep1(administrator, newAministrator);

    await mineBlocks(delay + 1)

    await setAdministratorStep2(administrator, newAministrator);
}

async function proposeAdministrator(guardian, newAministrator) {
    let proposeAdministratorTx = await bridge.connect(guardian).proposeAdministrator(newAministrator);
    await proposeAdministratorTx.wait();
}

async function unhalt(administrator) {
    let unhaltTx = await bridge.connect(administrator).unhalt();
    await expect(unhaltTx).to.emit(bridge, "Unhalted");
    await unhaltTx.wait();
    await expect(await bridge.halted()).to.be.equal(false);
}

async function setSoftDelay(administrator, delay) {
    let setSoftDelayTx = await bridge.connect(administrator).setSoftDelay(delay);
    await setSoftDelayTx.wait();
    await expect(await bridge.softDelay()).to.be.equal(BigNumber.from(delay));
}

async function setUnhaltDuration(administrator, duration) {
    let setUnhaltDurationTx = await bridge.connect(administrator).setUnhaltDuration(duration);
    await setUnhaltDurationTx.wait();
    await expect(await bridge.unhaltDuration()).to.be.equal(BigNumber.from(duration));
}

async function setEstimatedBlockTime(administrator, blockTime) {
    let setEstimatedBlockTimeTx = await bridge.connect(administrator).setEstimatedBlockTime(blockTime);
    await setEstimatedBlockTimeTx.wait();
    await expect(await bridge.estimatedBlockTime()).to.be.equal(BigNumber.from(blockTime));
}

async function setAllowKeyGen(administrator, value) {
    let setAllowKeyGenTx = await bridge.connect(administrator).setAllowKeyGen(value);
    await setAllowKeyGenTx.wait();
    await expect(await bridge.allowKeyGen()).to.be.equal(value);
}

async function setConfirmationsToFinality(administrator, confirmations) {
    let setConfirmationsToFinalityTx = await bridge.connect(administrator).setConfirmationsToFinality(confirmations);
    await setConfirmationsToFinalityTx.wait();
    await expect(await bridge.confirmationsToFinality()).to.be.equal(BigNumber.from(confirmations));
}

async function emergency(administrator) {
    let emergencyTx = await bridge.connect(administrator).emergency();
    await expect(emergencyTx).to.emit(bridge, "SetAdministrator").withArgs(zeroAddress, administrator.address);
    await expect(emergencyTx).to.emit(bridge, "SetTss").withArgs(zeroAddress, tss.address);
    await expect(emergencyTx).to.emit(bridge, "Halted").withArgs();
    await emergencyTx.wait();
    await expect(await bridge.administrator()).to.be.equal(zeroAddress);
    await expect(await bridge.tss()).to.be.equal(zeroAddress);
    await expect(await bridge.halted()).to.be.equal(true);
}

async function getSetTssSignature(tss, methodName, networkClass, chainId, bridge, nonce, newTss) {
    const message = abiCoder.encode(
        ["string", "uint256", "uint256", "address", "uint256", "address"],
        [methodName, networkClass, chainId, bridge, nonce, newTss]
    );
    const messageHash = keccak256(message);
    return await tss.signMessage(arrayify(messageHash))
}

async function getRedeemSignature(tss, bridge, to, token, amount, nonce) {
    const message = abiCoder.encode(
        ["uint256", "uint256", "address", "uint256", "address", "address", "uint256"],
        [networkClass, chainId, bridge, nonce, to, token, amount]
    );
    const messageHash = keccak256(message);
    return await tss.signMessage(arrayify(messageHash))
}

async function getHaltSignature(tss, methodName, networkClass, chainId, bridge, nonce) {
    const message = abiCoder.encode(
        ["string", "uint256", "uint256", "address", "uint256"],
        [methodName, networkClass, chainId, bridge, nonce]
    );
    const messageHash = keccak256(message);
    return await tss.signMessage(arrayify(messageHash))
}

async function redeemFirstStep(user, to, token, amount, nonce, signature) {
    let redeemTx = await bridge.connect(user).redeem(to, token, amount, nonce, signature);
    await expect(redeemTx).to.emit(bridge, "RegisteredRedeem").withArgs(nonce.toString(), to, token, amount);
    await redeemTx.wait();
}

async function redeemSecondStep(user, to, token, amount, nonce, signature) {
    let redeemTx = await bridge.connect(user).redeem(to, token, amount, nonce, signature);
    await expect(redeemTx).to.emit(bridge, "Redeemed").withArgs(nonce, to, token, amount);
    await redeemTx.wait();
}

async function redeem(user, to, token, amount, nonce, signature, delay) {
    await redeemFirstStep(user, to, token, amount, nonce, signature);
    await mineBlocks(delay + 1);
    await redeemSecondStep(user, to, token, amount, nonce, signature);
}

async function mineBlocks(blockNumber) {
    blockNumber = "0x" + blockNumber.toString(16)
    await ethers.provider.send("hardhat_mine", [blockNumber]);
}

async function mineHack(blockNumber) {
    await ethers.provider.send("evm_setAutomine", [false]);
    await ethers.provider.send("evm_setIntervalMining", [0]);

    blockNumber = "0x" + blockNumber.toString(16)
    await ethers.provider.send("hardhat_mine", [blockNumber]);
    // re-enable auto-mining when you are done, so you dont need to manually mine future blocks
    await ethers.provider.send("evm_setAutomine", [true]);
}

module.exports = {
    bridge: function() {return bridge},
    ownedToken1: function() {return ownedToken1},
    ownedToken2: function() {return ownedToken2},
    notOwnedToken1: function() {return notOwnedToken1},
    notOwnedToken2: function() {return notOwnedToken2},
    wETH: function() {return wETH},
    token3: function() {return token3},
    administrator: function() {return administrator},
    tss: function() {return tss},
    ercAdmin: function() {return ercAdmin},
    user1: function() {return user1},
    user2: function() {return user2},
    user3: function() {return user3},
    user4: function() {return user4},
    user5: function() {return user5},

    networkClass, chainId, zeroAddress, zeroAmountBig, uint256Max, znnAddress,
    unhaltDuration, administratorDelay, softDelay, redeemDelay, redeemDelayBig, blockTime, confirmationsToFinality,

    activateBridgeStep0,
    activateBridgeStep1,
    activateBridgeStep2,
    activateBridgeStep3,
    activateBridgeStep4,
    activateBridgeStep5,
    setTokenInfoStep1,
    setTokenInfoStep2,
    setTokenInfo,
    setTssStep1,
    setTssStep2,
    setTssWithAdmin,
    setTssWithSignature,
    unwrap,
    halt,
    revokeRedeems,
    nominateGuardiansStep1,
    nominateGuardiansStep2,
    nominateGuardians,
    proposeAdministrator,
    setAdministratorStep1,
    setAdministratorStep2,
    setAdministrator,
    unhalt,
    setSoftDelay,
    setUnhaltDuration,
    setEstimatedBlockTime,
    setAllowKeyGen,
    setConfirmationsToFinality,
    emergency,
    getSetTssSignature,
    getRedeemSignature,
    getHaltSignature,
    redeemFirstStep,
    redeemSecondStep,
    redeem,
    mineBlocks,
    mineHack,
}