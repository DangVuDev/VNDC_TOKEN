    // SPDX-License-Identifier: MIT
    pragma solidity ^0.8.20;

    import "@openzeppelin/contracts/access/Ownable.sol";
    import "@openzeppelin/contracts/utils/Pausable.sol";
    import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
    import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
    import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

    // TaskManager is a minimal treasury contract for VNDC token.
    // - Anyone can deposit tokens into the pool via fundPool.
    // - Only owner (admin) can withdraw tokens, pause, and unpause.
    contract TaskManager is Ownable, Pausable, ReentrancyGuard {
        using SafeERC20 for IERC20;

        event PoolFunded(address indexed funder, uint256 amount, uint256 newBalance);
        event PoolWithdrawn(address indexed to, uint256 amount, uint256 newBalance);

        IERC20 public immutable vndc;

        constructor(address vndcToken) Ownable(msg.sender) {
            require(vndcToken != address(0), "zero vndc");
            vndc = IERC20(vndcToken);
        }

        // Anyone can deposit VNDC into the pool when contract is not paused.
        function fundPool(uint256 amount) external whenNotPaused {
            require(amount > 0, "zero amount");
            vndc.safeTransferFrom(msg.sender, address(this), amount);
            emit PoolFunded(msg.sender, amount, vndc.balanceOf(address(this)));
        }

        // Only admin can withdraw VNDC from the pool when contract is not paused.
        function withdrawPool(address to, uint256 amount) external onlyOwner nonReentrant whenNotPaused {
            require(to != address(0), "zero recipient");
            require(amount > 0, "zero amount");
            require(vndc.balanceOf(address(this)) >= amount, "insufficient pool");

            vndc.safeTransfer(to, amount);
            emit PoolWithdrawn(to, amount, vndc.balanceOf(address(this)));
        }

        // Compatible pool balance getter for offchain workers.
        function poolBalance() external view returns (uint256) {
            return vndc.balanceOf(address(this));
        }

        // Admin controls emergency stop.
        function pause() external onlyOwner {
            _pause();
        }

        function unpause() external onlyOwner {
            _unpause();
        }
    }