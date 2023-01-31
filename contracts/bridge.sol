// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

struct TokenInfo {
    uint256 minAmount;
    uint256 redeemDelayInBlocks;
    bool bridgeable;
    bool redeemable;
    bool owned; // whether or not we have mint rights on the token
}

struct RedeemInfo {
    uint256 blockNumber;
    bytes32 paramsHash;
}

contract Bridge is Context {
    using ECDSA for bytes32;
    using SafeERC20 for IERC20;

    event RegisteredRedeem(uint256 indexed nonce, address indexed to, address indexed token, uint256 amount);
    event Redeemed(uint256 indexed nonce, address indexed to, address indexed token, uint256 amount);
    event Unwrapped(address indexed from, address indexed token, string to, uint256 amount);
    event Halted();
    event Unhalted();
    event RevokedRedeem(uint256 indexed nonce);
    event PendingAdministrator(address indexed newAdministrator);
    event ChangedAdministrator(address indexed newAdministrator, address oldAdministrator);
    event PendingTssAddress(address indexed newTssAddress);
    event ChangedTssAddress(address indexed newTssAddress, address oldTssAddress);
    event PendingGuardians();
    event ChangedGuardians();

    address public administrator;
    address public requestedAdministrator;
    uint256 public administratorChangeBlock;
    uint256 public administratorDelay;
    uint256 public minAdministratorDelay;

    address public tssAddress;
    address public requestedTssAddress;
    uint256 public tssAddressChangeBlock;
    uint256 public changeTssAddressDelay;
    uint256 public minTssAddressChangeDelay;

    address[] public guardians;
    address[] public nominatedGuardians;
    address[] public guardiansVotes;
    mapping(address => uint) public votesCount;
    uint256 public guardianChangeBlock;
    uint8 private constant  minNominatedGuardians = 5;
    // same delay as change administrator

    uint256 public unhaltedAt;
    uint256 public unhaltDurationInBlocks;
    uint256 public minUnhaltDurationInBlocks;
    uint256 public actionsNonce;
    uint256 public contractDeploymentHeight;
    uint64 public estimatedBlockTime;
    uint64 public confirmationsToFinality;

    uint32 private constant networkType = 2;
    bool public halted;
    bool public allowKeyGen;

    mapping(uint256 => RedeemInfo) public redeemsInfo;
    mapping(address => TokenInfo) public tokensInfo;

    // todo check that tssAddress is != 0?
    modifier isNotHalted() {
        require(halted == false, "bridge: Is halted");
        require(unhaltedAt + unhaltDurationInBlocks < block.number, "bridge: Is halted");
        _;
    }

    modifier onlyAdministrator() {
        require(_msgSender() == administrator, "bridge: Caller not administrator");
        _;
    }

    constructor(uint256 unhaltDuration, uint256 administratorDelayParam, uint256 tssDelay, uint64 blockTime, uint64 confirmations, address[] memory initialGuardians) {
        administrator = _msgSender();
        emit ChangedAdministrator(administrator, address(0));

        minUnhaltDurationInBlocks = unhaltDuration;
        unhaltDurationInBlocks = minUnhaltDurationInBlocks;

        minAdministratorDelay = administratorDelayParam;
        administratorDelay = minAdministratorDelay;

        minTssAddressChangeDelay = tssDelay;
        changeTssAddressDelay = minTssAddressChangeDelay;

        for(uint i = 0; i < initialGuardians.length; i++) {
            guardians.push(initialGuardians[i]);
            guardiansVotes.push(address(0));
        }

        estimatedBlockTime = blockTime;
        confirmationsToFinality = confirmations;
        contractDeploymentHeight = block.number;
    }

    function isHalted() view public returns (bool) {
        return halted || (unhaltedAt + unhaltDurationInBlocks >= block.number);
    }

    // implement restrictions for amount
    // todo uint256max to const
    function redeem(address to, address token, uint256 amount, uint256 nonce, bytes memory signature) external isNotHalted {
        require(tokensInfo[token].redeemable == true, "redeem: Token not redeemable");
        require(redeemsInfo[nonce].blockNumber != type(uint256).max, "redeem: Nonce already redeemed");
        require((redeemsInfo[nonce].blockNumber + tokensInfo[token].redeemDelayInBlocks) < block.number, "redeem: Not redeemable yet");

        // todo change to block.chainId
        // TODO Should we check the sig only at the first redeem step?
        bytes32 messageHash = keccak256(abi.encode(networkType, uint256(31337), address(this), nonce, to, token, amount));
        messageHash = messageHash.toEthSignedMessageHash();
        address signer = messageHash.recover(signature);
        require(signer == tssAddress, "redeem: Wrong signature");

        if (redeemsInfo[nonce].blockNumber == 0) {
            redeemsInfo[nonce].blockNumber = block.number;
            redeemsInfo[nonce].paramsHash = keccak256(abi.encode(to, token, amount));
            emit RegisteredRedeem(nonce, to, token, amount);
        } else {
            require(redeemsInfo[nonce].paramsHash == keccak256(abi.encode(to, token, amount)), "redeem: Second redeem has a different params than the first one");

            // it cannot be type(uint256).max or in delay
            redeemsInfo[nonce].blockNumber = type(uint256).max;
            // if we have ownership of the token then it means that this token is wrapped and we should have mint rights on it
            if (tokensInfo[token].owned) {
                // we should have 0 balance of this wrapped token, they are only distributed to people, unless someone sent to this contract
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

        uint256 oldBalance = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(_msgSender(), address(this), amount);
        uint256 newBalance = IERC20(token).balanceOf(address(this));
        require(amount <= newBalance, "unwrap: amount bigger than the new balance");
        require(newBalance - amount == oldBalance, "unwrap: Tokens not sent");

        // if we have ownership to this token, we will burn because we can mint on redeem, otherwise we just keep the tokens
        if (tokensInfo[token].owned) {
            bytes memory payload = abi.encodeWithSignature("burn(uint256)", amount);
            (bool success, ) = token.call(payload);
            require(success, "unwrap: Burn call failed");
        }

        emit Unwrapped(_msgSender(), token, to, amount);
    }

    function setTokenInfo(address token, uint256 minAmount, uint256 redeemDelay, bool bridgeable, bool redeemable, bool isOwned) external onlyAdministrator {
        tokensInfo[token].minAmount = minAmount;
        tokensInfo[token].redeemDelayInBlocks = redeemDelay;
        tokensInfo[token].bridgeable = bridgeable;
        tokensInfo[token].redeemable = redeemable;
        tokensInfo[token].owned = isOwned;
    }

    function halt(bytes memory signature) external {
        if (_msgSender() != administrator) {
            // todo change to block.chainid
            bytes32 messageHash = keccak256(abi.encode("halt", networkType, uint256(31337), address(this), actionsNonce));
            messageHash = messageHash.toEthSignedMessageHash();
            address signer = messageHash.recover(signature);
            require(signer == tssAddress, "halt: Wrong signature");
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
            redeemsInfo[nonces[i]].blockNumber = type(uint256).max;
            emit RevokedRedeem(nonces[i]);
        }
    }

    function changeAdministrator(address newAdministrator) external onlyAdministrator {
        require(newAdministrator != address(0), "changeAdministrator: Invalid administrator address");

        if (requestedAdministrator == newAdministrator) {
            if (administratorChangeBlock + administratorDelay < block.number) {
                emit ChangedAdministrator(newAdministrator, administrator);
                administrator = newAdministrator;
                requestedAdministrator = address(0);
            } else {
                revert("changeAdministrator: address change not due");
            }
        } else {
            requestedAdministrator = newAdministrator;
            administratorChangeBlock = block.number;
            emit PendingAdministrator(requestedAdministrator);
        }
    }

    function changeTssAddress(address newTssAddress, bytes memory oldSignature, bytes memory newSignature) external  {
        require(newTssAddress != address(0), "changeTssAddress: Invalid newTssAddress");

        if (_msgSender() != administrator) {
            // this only applies for non administrator calls
            require(allowKeyGen == true, "changeTssAddress: KeyGen is not allowed");
            require(!isHalted());
            allowKeyGen = false;

            // todo change to block.chainId
            bytes32 messageHash = keccak256(abi.encode("changeTssAddress", networkType, uint256(31337), address(this), actionsNonce, newTssAddress));
            messageHash = messageHash.toEthSignedMessageHash();
            address signer = messageHash.recover(oldSignature);
            require(signer == tssAddress, "changeTssAddress: Wrong old signature");

            signer = messageHash.recover(newSignature);
            require(signer == newTssAddress, "changeTssAddress: Wrong new signature");

            actionsNonce += 1;
        } else {
            if (requestedTssAddress == newTssAddress) {
                // this is ok, we can change the pub key and reset the requestedTssAddress
                if (tssAddressChangeBlock + changeTssAddressDelay < block.number) {
                    requestedTssAddress = address(0);
                } else {
                    revert("changeTssAddress: address change not due");
                }
            } else {
                requestedTssAddress = newTssAddress;
                tssAddressChangeBlock = block.number;
                emit PendingTssAddress(newTssAddress);
                return;
            }
        }

        emit ChangedTssAddress(newTssAddress, tssAddress);
        tssAddress = newTssAddress;
    }

    function emergency() external onlyAdministrator {
        emit ChangedAdministrator(address(0), administrator);
        administrator = address(0);

        emit ChangedTssAddress(address(0), tssAddress);
        tssAddress = address(0);

        halted = true;
        emit Halted();
    }

    function nominateGuardians(address[] memory newGuardians) external onlyAdministrator {
        require(newGuardians.length >= minNominatedGuardians, "nominateGuardians: length less than min");

        bool same = (newGuardians.length == nominatedGuardians.length);
        if (same) {
            for (uint i = 0; i < newGuardians.length; i++) {
                require(newGuardians[i] != address(0), "nominateGuardians: invalid guardian");
                same = same && (newGuardians[i] == nominatedGuardians[i]); // we require the same order
            }
        }

        if (same) {
            if (guardianChangeBlock + administratorDelay < block.number) {
                for (uint i = 0; i < guardians.length; i++) {
                    delete votesCount[guardiansVotes[i]];
                }
                delete guardiansVotes;
                delete guardians;
                delete nominatedGuardians;
                for (uint i = 0; i < newGuardians.length; i++) {
                    guardians.push(newGuardians[i]);
                    guardiansVotes.push(address(0));
                }
                emit ChangedGuardians();
            }
        } else {
            for (uint i = 0; i < newGuardians.length; i++) {
                for(uint j = i + 1; j < newGuardians.length; j++) {
                    if(newGuardians[i] == newGuardians[j]) {
                        revert("found duplicated guardian");
                    }
                }
            }

            delete nominatedGuardians;
            for (uint i = 0; i < newGuardians.length; i++) {
                nominatedGuardians.push(newGuardians[i]);
            }
            guardianChangeBlock = block.number;
            emit PendingGuardians();
        }
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
                    emit ChangedAdministrator(administrator, address(0));
                }
                break;
            }
        }
    }

    function setChangeTssAddressDelay(uint256 delay) external onlyAdministrator {
        require(delay >= minTssAddressChangeDelay, "setChangeTssAddressDelay: Delay is less than minimum");
        changeTssAddressDelay = delay;
    }

    function setUnhaltDuration(uint256 duration) external onlyAdministrator {
        require(duration >= minUnhaltDurationInBlocks, "setUnhaltDuration: New duration is smaller than the minimum one");
        unhaltDurationInBlocks = duration;
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