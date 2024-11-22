// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract WZNN is AccessControl, ERC20 {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(address bridgeAddress) ERC20("Wrapped ZNN", "wZNN") {
        _grantRole(MINTER_ROLE, bridgeAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    function decimals() public view override returns (uint8) {
        return 8;
    }

    function mint(address account, uint256 value) onlyRole(MINTER_ROLE) external {
        _mint(account, value);
    }

    function burn(uint value) external {
        _burn(_msgSender(), value);
    }
}