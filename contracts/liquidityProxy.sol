// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import './interfaces/IUniswapV2Router02.sol';
import './interfaces/IUniswapV2Factory.sol';
import './interfaces/IUniswapV2Pair.sol';
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

library TransferHelper {
    function safeTransferETH(address to, uint256 value) internal {
        (bool success, ) = to.call{value: value}(new bytes(0));
        require(success, 'TransferHelper::safeTransferETH: ETH transfer failed');
    }
}

contract LiquidityProxy is Ownable {
    using SafeERC20 for IERC20;

    IUniswapV2Router02 public router;
    IUniswapV2Factory public factory;
    IUniswapV2Pair public pair;
    address public wZNN;
    address public wETH;
    uint256 public liquidityLimit;

    constructor(address router_, address wZNN_) {
        router = IUniswapV2Router02(router_);
        factory = IUniswapV2Factory(router.factory());
        wZNN = wZNN_;
        wETH = router.WETH();
        pair = IUniswapV2Pair(factory.getPair(wZNN, wETH));
        require(address(pair) != address(0), "Proxy: Pair non existent");

        liquidityLimit = 100000 * 1e8;
    }

    receive() external payable {}

    function setLiquidityLimit(uint256 limit) onlyOwner external {
        liquidityLimit = limit;
    }

    function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin,
        address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity) {
        require(tokenA == wZNN, "Proxy: TokenA is not wZNN");
        require(tokenB == wETH, "Proxy: TokenB is not wETH");

        (uint256 reserve0, uint256 reserve1, ) = pair.getReserves();
        if (pair.token0() == wZNN) {
            require((reserve0 + amountADesired) <= liquidityLimit, "Proxy: Max liquidity reached");
        } else {
            require((reserve1 + amountADesired) <= liquidityLimit, "Proxy: Max liquidity reached");
        }

        IERC20(wZNN).safeTransferFrom(_msgSender(), address(this), amountADesired);
        IERC20(wZNN).approve(address(router), amountADesired);
        IERC20(wETH).safeTransferFrom(_msgSender(), address(this), amountBDesired);
        IERC20(wETH).approve(address(router), amountBDesired);
        (amountA, amountB, liquidity) = router.addLiquidity(wZNN, wETH, amountADesired, amountBDesired, amountAMin, amountBMin, to, deadline);

        if (amountADesired > amountA) {
            IERC20(wZNN).safeTransfer(_msgSender(), amountADesired - amountA);
        }
        if (amountBDesired > amountB) {
            IERC20(wETH).safeTransfer(_msgSender(), amountBDesired - amountB);
        }
    }

    function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to,
        uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity) {
        require(token == wZNN, "Proxy: Token is not wZNN");

        (uint256 reserve0, uint256 reserve1, ) = pair.getReserves();
        if (pair.token0() == wZNN) {
            require((reserve0 + amountTokenDesired) <= liquidityLimit, "Proxy: Max liquidity reached");
        } else {
            require((reserve1 + amountTokenDesired) <= liquidityLimit, "Proxy: Max liquidity reached");
        }

        IERC20(wZNN).safeTransferFrom(_msgSender(), address(this), amountTokenDesired);
        IERC20(wZNN).approve(address(router), amountTokenDesired);

        (amountToken, amountETH, liquidity) = router.addLiquidityETH{value: msg.value}(wZNN, amountTokenDesired, amountTokenMin, amountETHMin, to, deadline);

        if (amountTokenDesired > amountToken) {
            IERC20(wZNN).safeTransfer(_msgSender(), amountTokenDesired - amountToken);
        }
        if (msg.value > amountETH) {
            TransferHelper.safeTransferETH(_msgSender(), msg.value - amountETH);
        }
    }
}
