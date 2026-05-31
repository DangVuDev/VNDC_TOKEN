// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title VNDCStaking
 * @dev Staking contract for VNDC tokens with reward distribution
 *
 * Features:
 * - Stake VNDC tokens and earn rewards
 * - Multiple reward tiers based on lock period
 * - Auto-compounding rewards
 * - Emergency withdrawal
 * - Admin controls for reward rate adjustment
 */
contract VNDCStaking is ReentrancyGuard, AccessControl {
    // ─────────────────────────────────────────────
    //  Constants & State Variables
    // ─────────────────────────────────────────────

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    IERC20 public vndc;

    /// @dev Annual reward rate (basis points, e.g., 1000 = 10%)
    uint256 public rewardRate = 1000; // 10% APY

    /// @dev Minimum staking amount
    uint256 public minStakeAmount = 100 * 10 ** 18; // 100 VNDC

    /// @dev Stake duration tiers and their multipliers (in basis points)
    mapping(uint256 => uint256) public stakingMultipliers; // duration => multiplier

    /// @dev User staking information
    struct Stake {
        uint256 amount;
        uint256 startTime;
        uint256 duration; // in seconds
        uint256 rewards;
        bool locked;
    }

    mapping(address => Stake) public stakes;

    /// @dev Total staked amount
    uint256 public totalStaked;

    /// @dev Total rewards distributed
    uint256 public totalRewardsDistributed;

    // ─────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────

    event Staked(address indexed user, uint256 amount, uint256 duration);
    event Unstaked(address indexed user, uint256 amount, uint256 rewards);
    event RewardsClaimed(address indexed user, uint256 amount);
    event RewardRateUpdated(uint256 newRate);
    event StakingMultiplierUpdated(uint256 duration, uint256 multiplier);

    // ─────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────

    constructor(address _vndcToken) {
        require(_vndcToken != address(0), "Invalid token address");
        vndc = IERC20(_vndcToken);

        // Grant roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);

        // Initialize staking multipliers
        // 3 months = 100% multiplier
        stakingMultipliers[90 days] = 10000;
        // 6 months = 120% multiplier
        stakingMultipliers[180 days] = 12000;
        // 12 months = 150% multiplier
        stakingMultipliers[365 days] = 15000;
        // 24 months = 200% multiplier
        stakingMultipliers[730 days] = 20000;
    }

    // ─────────────────────────────────────────────
    //  Staking Functions
    // ─────────────────────────────────────────────

    /**
     * @dev Stake VNDC tokens
     * @param amount The amount to stake
     * @param duration The staking duration in seconds
     */
    function stake(uint256 amount, uint256 duration) external nonReentrant {
        require(amount >= minStakeAmount, "Amount below minimum");
        require(stakingMultipliers[duration] > 0, "Invalid duration");
        require(stakes[msg.sender].amount == 0, "Already staking");

        // Transfer tokens from user
        require(
            vndc.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );

        stakes[msg.sender] = Stake({
            amount: amount,
            startTime: block.timestamp,
            duration: duration,
            rewards: 0,
            locked: true
        });

        totalStaked += amount;

        emit Staked(msg.sender, amount, duration);
    }

    /**
     * @dev Claim staking rewards (auto-compounding)
     */
    function claimRewards() external nonReentrant {
        Stake storage userStake = stakes[msg.sender];
        require(userStake.amount > 0, "No stake found");

        uint256 rewards = calculatePendingRewards(msg.sender);
        require(rewards > 0, "No rewards to claim");

        // Update stake amount to include rewards (auto-compound)
        userStake.amount += rewards;
        userStake.rewards = 0;
        userStake.startTime = block.timestamp; // Reset start time for next calculation

        totalRewardsDistributed += rewards;

        emit RewardsClaimed(msg.sender, rewards);
    }

    /**
     * @dev Unstake tokens after lock period ends
     */
    function unstake() external nonReentrant {
        Stake storage userStake = stakes[msg.sender];
        require(userStake.amount > 0, "No stake found");
        require(
            block.timestamp >= userStake.startTime + userStake.duration,
            "Still locked"
        );

        uint256 amount = userStake.amount;
        uint256 rewards = calculatePendingRewards(msg.sender);
        uint256 totalReturn = amount + rewards;

        // Clear stake
        delete stakes[msg.sender];
        totalStaked -= amount;

        // Transfer back to user
        require(vndc.transfer(msg.sender, totalReturn), "Transfer failed");

        totalRewardsDistributed += rewards;

        emit Unstaked(msg.sender, amount, rewards);
    }

    /**
     * @dev Emergency unstake (without waiting for lock period)
     * Withdraws with 50% penalty on rewards
     */
    function emergencyUnstake() external nonReentrant {
        Stake storage userStake = stakes[msg.sender];
        require(userStake.amount > 0, "No stake found");

        uint256 amount = userStake.amount;
        uint256 rewards = calculatePendingRewards(msg.sender);
        uint256 penalty = (rewards * 50) / 100; // 50% penalty
        uint256 claimedRewards = rewards - penalty;
        uint256 totalReturn = amount + claimedRewards;

        delete stakes[msg.sender];
        totalStaked -= amount;

        require(vndc.transfer(msg.sender, totalReturn), "Transfer failed");

        totalRewardsDistributed += claimedRewards;

        emit Unstaked(msg.sender, amount, claimedRewards);
    }

    // ─────────────────────────────────────────────
    //  View Functions
    // ─────────────────────────────────────────────

    /**
     * @dev Calculate pending rewards for a staker
     * @param user The staker address
     * @return The pending reward amount
     */
    function calculatePendingRewards(address user) public view returns (uint256) {
        Stake memory userStake = stakes[user];
        if (userStake.amount == 0) return 0;

        uint256 stakedTime = block.timestamp - userStake.startTime;
        uint256 multiplier = stakingMultipliers[userStake.duration];

        // Calculate annual rewards
        uint256 annualReward = (userStake.amount * rewardRate) / 10000;

        // Apply multiplier
        uint256 multipliedReward = (annualReward * multiplier) / 10000;

        // Calculate pro-rata rewards
        uint256 rewards = (multipliedReward * stakedTime) / 365 days;

        return rewards + userStake.rewards;
    }

    /**
     * @dev Get staking information for a user
     * @param user The user address
     * @return stakeInfo The user's stake information
     */
    function getStake(address user) external view returns (Stake memory stakeInfo) {
        return stakes[user];
    }

    /**
     * @dev Get time remaining for stake unlock
     * @param user The user address
     * @return The time in seconds until unlock, or 0 if unlocked
     */
    function getTimeToUnlock(address user) external view returns (uint256) {
        Stake memory userStake = stakes[user];
        if (userStake.amount == 0) return 0;

        uint256 unlockTime = userStake.startTime + userStake.duration;
        if (block.timestamp >= unlockTime) return 0;

        return unlockTime - block.timestamp;
    }

    // ─────────────────────────────────────────────
    //  Admin Functions
    // ─────────────────────────────────────────────

    /**
     * @dev Update reward rate
     * @param newRate The new reward rate in basis points
     */
    function setRewardRate(uint256 newRate) external onlyRole(ADMIN_ROLE) {
        require(newRate <= 5000, "Rate too high (max 50%)");
        rewardRate = newRate;
        emit RewardRateUpdated(newRate);
    }

    /**
     * @dev Set staking multiplier for a duration
     * @param duration The duration in seconds
     * @param multiplier The multiplier in basis points
     */
    function setStakingMultiplier(uint256 duration, uint256 multiplier)
        external
        onlyRole(ADMIN_ROLE)
    {
        require(duration > 0, "Invalid duration");
        require(multiplier > 0, "Invalid multiplier");
        stakingMultipliers[duration] = multiplier;
        emit StakingMultiplierUpdated(duration, multiplier);
    }

    /**
     * @dev Set minimum stake amount
     * @param _minAmount The new minimum amount
     */
    function setMinStakeAmount(uint256 _minAmount) external onlyRole(ADMIN_ROLE) {
        minStakeAmount = _minAmount;
    }

    /**
     * @dev Withdraw unclaimed rewards (emergency only)
     */
    function withdrawUnclaimed() external onlyRole(ADMIN_ROLE) {
        uint256 balance = vndc.balanceOf(address(this));
        uint256 lockedAmount = totalStaked;
        require(balance > lockedAmount, "No unclaimed rewards");

        uint256 unclaimed = balance - lockedAmount;
        require(vndc.transfer(msg.sender, unclaimed), "Transfer failed");
    }
}
