// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

struct TokenInfo {
    uint256 minAmount;
    uint256 redeemDelay;
    bool bridgeable;
    bool redeemable;
    bool owned; // whether or not the bridge has mint rights on the token
}

struct RedeemInfo {
    uint256 blockNumber;
    bytes32 paramsHash;
}

interface IOwned {
    function owner() external view returns (address);
}

contract Bridge is Context {
    using ECDSA for bytes32;
    using SafeERC20 for IERC20;

    event RegisteredRedeem(uint256 indexed nonce, address indexed to, address indexed token, uint256 amount);
    event Redeemed(uint256 indexed nonce, address indexed to, address indexed token, uint256 amount);
    event Unwrapped(address indexed from, address indexed token, string to, uint256 amount);
    event Halted();
    event Unhalted();
    event PendingTokenInfo(address indexed token);
    event SetTokenInfo(address indexed token);
    event RevokedRedeem(uint256 indexed nonce);
    event PendingAdministrator(address indexed newAdministrator);
    event SetAdministrator(address indexed newAdministrator, address oldAdministrator);
    event PendingTss(address indexed newTss);
    event SetTss(address indexed newTss, address oldTss);
    event PendingGuardians();
    event SetGuardians();

    uint256 constant uint256max = type(uint256).max;
    uint32 private constant networkClass = 2;
    uint8 private constant  minNominatedGuardians = 5;

    uint64 public estimatedBlockTime;
    uint64 public confirmationsToFinality;
    bool public halted;
    bool public allowKeyGen;

    address public administrator;
    uint256 public administratorDelay;
    uint256 public minAdministratorDelay;

    address public tss;
    uint256 public softDelay;
    uint256 public minSoftDelay;

    address[] public guardians;
    address[] public guardiansVotes;
    mapping(address => uint) public votesCount;
    // same delay as set administrator

    uint256 public unhaltedAt;
    uint256 public unhaltDuration;
    uint256 public minUnhaltDuration;
    uint256 public actionsNonce;
    uint256 public contractDeploymentHeight;

    mapping(uint256 => RedeemInfo) public redeemsInfo;
    mapping(address => TokenInfo) public tokensInfo;
    mapping(string => RedeemInfo) public timeChallengesInfo;

    modifier isNotHalted() {
        require(halted == false, "bridge: Is halted");
        require(unhaltedAt + unhaltDuration < block.number, "bridge: Is halted");
        _;
    }

    modifier onlyAdministrator() {
        require(_msgSender() == administrator, "bridge: Caller not administrator");
        _;
    }

    constructor(uint256 unhaltDurationParam, uint256 administratorDelayParam, uint256 softDelayParam, uint64 blockTime, uint64 confirmations, address[] memory initialGuardians) {
        administrator = _msgSender();
        emit SetAdministrator(administrator, address(0));

        minUnhaltDuration = unhaltDurationParam;
        unhaltDuration = minUnhaltDuration;

        minAdministratorDelay = administratorDelayParam;
        administratorDelay = minAdministratorDelay;

        minSoftDelay = softDelayParam;
        softDelay = minSoftDelay;

        for(uint i = 0; i < initialGuardians.length; i++) {
            guardians.push(initialGuardians[i]);
            guardiansVotes.push(address(0));
        }

        estimatedBlockTime = blockTime;
        confirmationsToFinality = confirmations;
        contractDeploymentHeight = block.number;
    }

    function isHalted() view public returns (bool) {
        return halted || (unhaltedAt + unhaltDuration >= block.number);
    }

    // implement restrictions for amount
    function redeem(address to, address token, uint256 amount, uint256 nonce, bytes memory signature) external isNotHalted {
        require(tokensInfo[token].redeemable == true, "redeem: Token not redeemable");
        require(redeemsInfo[nonce].blockNumber != uint256max, "redeem: Nonce already redeemed");
        require((redeemsInfo[nonce].blockNumber + tokensInfo[token].redeemDelay) < block.number, "redeem: Not redeemable yet");

        if (redeemsInfo[nonce].blockNumber == 0) {
            // We only check the signature at the first redeem, on the second one we have only a check for the same parameters
            // In case the tss key is changed, we don't need to resign the transaction for the second redeem
            // todo change to block.chainId
            bytes32 messageHash = keccak256(abi.encode(networkClass, uint256(31337), address(this), nonce, to, token, amount));
            messageHash = messageHash.toEthSignedMessageHash();
            address signer = messageHash.recover(signature);
            require(signer == tss, "redeem: Wrong signature");

            redeemsInfo[nonce].blockNumber = block.number;
            redeemsInfo[nonce].paramsHash = keccak256(abi.encode(to, token, amount));
            emit RegisteredRedeem(nonce, to, token, amount);
        } else {
            require(redeemsInfo[nonce].paramsHash == keccak256(abi.encode(to, token, amount)), "redeem: Second redeem has different params than the first one");

            // it cannot be uint256max or in delay
            redeemsInfo[nonce].blockNumber = uint256max;
            // if the bridge has ownership of the token then it means that this token is wrapped and it should have mint rights on it
            if (tokensInfo[token].owned) {
                // bridge should have 0 balance of this wrapped token, they are only distributed to people, unless someone sent to this contract
                // mint the needed amount
                bytes memory payload = abi.encodeWithSignature("mint(uint256)", amount);
                (bool success, ) = token.call(payload);
                require(success, "redeem: mint call failed");
            }
            // if we do not own the token it means it is probably originating from this network so we should have locked tokens here
            // even if we minted or not, we send the amount
            IERC20(token).safeTransfer(to, amount);

            emit Redeemed(nonce, to, token, amount);
        }
    }

    function unwrap(address token, uint256 amount, string memory to) external isNotHalted {
        require(tokensInfo[token].bridgeable == true, "unwrap: Token not bridgeable");
        require(amount >= tokensInfo[token].minAmount, "unwrap: Amount has to be greater then the token minAmount");
        // In case a user inserts the wrong address length this won't work, in case someone inserts characters encoded from multiple
        // bytes the orchestrator won't process it and even if so, he won't be able to redeem it on the znn network
        require(bytes(to).length == 40, "unwrap: Invalid NoM address length");

        uint256 oldBalance = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(_msgSender(), address(this), amount);
        uint256 newBalance = IERC20(token).balanceOf(address(this));
        require(amount <= newBalance, "unwrap: amount bigger than the new balance");
        require(newBalance - amount == oldBalance, "unwrap: Tokens not sent");

        // if we have ownership to this token, we will burn because we can mint on redeem, otherwise we just keep the tokens
        // double check the ownership so we don't burn in case owned is set to true by mistake
        if (tokensInfo[token].owned) {
            try IOwned(token).owner() {
                if(IOwned(token).owner() == address(this)) {
                    bytes memory payload = abi.encodeWithSignature("burn(uint256)", amount);
                    (bool success, ) = token.call(payload);
                    require(success, "unwrap: Burn call failed");
                }
            } catch {
                revert("unwrap: Owner call failed");
            }
        }
        emit Unwrapped(_msgSender(), token, to, amount);
    }

    function timeChallenge(string memory methodName, bytes32 paramsHash, uint256 challengeDelay) internal {
        if (timeChallengesInfo[methodName].paramsHash == paramsHash) {
            if (timeChallengesInfo[methodName].blockNumber + challengeDelay >= block.number) {
                revert("challenge not due");
            }
            // otherwise the challenge is due and we reset it
            delete timeChallengesInfo[methodName].paramsHash;
        } else {
            // we start a new challenge
            timeChallengesInfo[methodName].paramsHash = paramsHash;
            timeChallengesInfo[methodName].blockNumber = block.number;
        }
    }

    function setTokenInfo(address token, uint256 minAmount, uint256 redeemDelay, bool bridgeable, bool redeemable, bool isOwned) external onlyAdministrator {
        require(redeemDelay > 2, "setTokenInfo: RedeemDelay is less than minimum");

        bytes32 paramsHash = keccak256(abi.encode(token, minAmount, redeemDelay, bridgeable, redeemable, isOwned));
        timeChallenge("setTokenInfo", paramsHash, softDelay);
        // early return for when we have a new challenge
        if (timeChallengesInfo["setTokenInfo"].paramsHash != bytes32(0)) {
            emit PendingTokenInfo(token);
            return;
        }

        tokensInfo[token].minAmount = minAmount;
        tokensInfo[token].redeemDelay = redeemDelay;
        tokensInfo[token].bridgeable = bridgeable;
        tokensInfo[token].redeemable = redeemable;
        tokensInfo[token].owned = isOwned;
        emit SetTokenInfo(token);
    }

    function halt(bytes memory signature) external {
        if (_msgSender() != administrator) {
            // todo change to block.chainid
            bytes32 messageHash = keccak256(abi.encode("halt", networkClass, uint256(31337), address(this), actionsNonce));
            messageHash = messageHash.toEthSignedMessageHash();
            address signer = messageHash.recover(signature);
            require(signer == tss, "halt: Wrong signature");
            actionsNonce += 1;
        }

        halted = true;
        emit Halted();
    }

    function unhalt() external onlyAdministrator {
        require(halted == true, "unhalt: halted is false");

        halted = false;
        unhaltedAt = block.number;
        emit Unhalted();
    }

    // This method would be called if we detect a redeem transaction that did not originated from a user embedded bridge call on the znn network
    function revokeRedeems(uint256[] memory nonces) external onlyAdministrator {
        for(uint i = 0; i < nonces.length; i++) {
            redeemsInfo[nonces[i]].blockNumber = uint256max;
            emit RevokedRedeem(nonces[i]);
        }
    }

    function setAdministrator(address newAdministrator) external onlyAdministrator {
        require(newAdministrator != address(0), "setAdministrator: Invalid administrator address");

        bytes32 paramsHash = keccak256(abi.encode(newAdministrator));
        timeChallenge("setAdministrator", paramsHash, administratorDelay);
        // early return for when we have a new challenge
        if (timeChallengesInfo["setAdministrator"].paramsHash != bytes32(0)) {
            emit PendingAdministrator(newAdministrator);
            return;
        }

        emit SetAdministrator(newAdministrator, administrator);
        administrator = newAdministrator;
    }

    function setTss(address newTss, bytes memory oldSignature, bytes memory newSignature) external  {
        require(newTss != address(0), "setTss: Invalid newTss");

        if (_msgSender() != administrator) {
            // this only applies for non administrator calls
            require(allowKeyGen == true, "setTss: KeyGen is not allowed");
            require(!isHalted(), "setTss: Bridge halted");
            allowKeyGen = false;

            // todo change to block.chainId
            bytes32 messageHash = keccak256(abi.encode("setTss", networkClass, uint256(31337), address(this), actionsNonce, newTss));
            messageHash = messageHash.toEthSignedMessageHash();
            address signer = messageHash.recover(oldSignature);
            require(signer == tss, "setTss: Wrong old signature");

            signer = messageHash.recover(newSignature);
            require(signer == newTss, "setTss: Wrong new signature");

            actionsNonce += 1;
        } else {
            bytes32 paramsHash = keccak256(abi.encode(newTss));
            timeChallenge("setTss", paramsHash, softDelay);
            // early return for when we have a new challenge
            if (timeChallengesInfo["setTss"].paramsHash != bytes32(0)) {
                emit PendingTss(newTss);
                return;
            }
        }

        emit SetTss(newTss, tss);
        tss = newTss;
    }

    function emergency() external onlyAdministrator {
        emit SetAdministrator(address(0), administrator);
        administrator = address(0);

        emit SetTss(address(0), tss);
        tss = address(0);

        halted = true;
        emit Halted();
    }

    function nominateGuardians(address[] memory newGuardians) external onlyAdministrator {
        require(newGuardians.length >= minNominatedGuardians, "nominateGuardians: Length less than minimum");

        bytes32 paramsHash = keccak256(abi.encode(newGuardians));
        timeChallenge("nominateGuardians", paramsHash, administratorDelay);
        // early return for when we have a new challenge
        if (timeChallengesInfo["nominateGuardians"].paramsHash != bytes32(0)) {
            // we check for duplicates only on new challenges
            for (uint i = 0; i < newGuardians.length; i++) {
                if(newGuardians[i] == address(0)) {
                    revert("nominateGuardians: Found zero address");
                }
                for(uint j = i + 1; j < newGuardians.length; j++) {
                    if(newGuardians[i] == newGuardians[j]) {
                        revert("nominateGuardians: Found duplicated guardian");
                    }
                }
            }
            emit PendingGuardians();
            return;
        }

        for (uint i = 0; i < guardians.length; i++) {
            delete votesCount[guardiansVotes[i]];
        }
        delete guardiansVotes;
        delete guardians;
        for (uint i = 0; i < newGuardians.length; i++) {
            guardians.push(newGuardians[i]);
            guardiansVotes.push(address(0));
        }
        emit SetGuardians();
    }

    function proposeAdministrator(address newAdministrator) external {
        require(administrator == address(0), "proposeAdministrator: Bridge not in emergency");
        require(newAdministrator != address(0), "proposeAdministrator: Invalid new address");

        for(uint i = 0; i < guardians.length; i++) {
            if (guardians[i] == _msgSender()) {
                if (guardiansVotes[i] != address(0)) {
                    votesCount[guardiansVotes[i]] -= 1;
                }
                guardiansVotes[i] = newAdministrator;
                votesCount[guardiansVotes[i]] += 1;
                uint threshold = guardians.length / 2;
                if (votesCount[guardiansVotes[i]] > threshold) {
                    for(uint j = 0; j < guardiansVotes.length; j++) {
                        delete votesCount[guardiansVotes[j]];
                        guardiansVotes[j] = address(0);
                    }
                    administrator = newAdministrator;
                    emit SetAdministrator(administrator, address(0));
                }
                break;
            }
        }
    }

    function setSoftDelay(uint256 delay) external onlyAdministrator {
        require(delay >= minSoftDelay, "setSoftDelay: Delay is less than minimum");
        softDelay = delay;
    }

    function setUnhaltDuration(uint256 duration) external onlyAdministrator {
        require(duration >= minUnhaltDuration, "setUnhaltDuration: Duration is less than minimum");
        unhaltDuration = duration;
    }

    function setEstimatedBlockTime(uint64 blockTime) external onlyAdministrator {
        require(blockTime > 0, "setEstimatedBlockTime: BlockTime is less than minimum");
        estimatedBlockTime = blockTime;
    }

    function setAllowKeyGen(bool value) external onlyAdministrator {
        allowKeyGen = value;
    }

    function setConfirmationsToFinality(uint64 confirmations) external onlyAdministrator {
        require(confirmations > 1, "setConfirmationsToFinality: Confirmations is less than minimum");
        confirmationsToFinality = confirmations;
    }
}