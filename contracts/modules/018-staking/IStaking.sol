// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IStaking
 * @notice Interface for the Campus Staking Pool — stake VNDC tokens to earn
 *         rewards, supporting flexible & fixed-term pools with compound interest.
 */
interface IStaking {
    // ─── Enums ───
    enum PoolType { Flexible, Fixed30, Fixed90, Fixed180, Fixed365 }
    enum StakeStatus { Active, Unstaked, Emergency }

    // ─── Events ───
    event PoolCreated(uint256 indexed poolId, PoolType poolType, uint256 apy, uint256 minStake, uint256 lockDays, uint256 timestamp);
    event PoolUpdated(uint256 indexed poolId, uint256 newApy, bool active, uint256 timestamp);
    event Staked(address indexed user, uint256 indexed poolId, uint256 indexed stakeId, uint256 amount, uint256 timestamp);
    event Unstaked(address indexed user, uint256 indexed stakeId, uint256 principal, uint256 reward, uint256 timestamp);
    event RewardsClaimed(address indexed user, uint256 indexed stakeId, uint256 reward, uint256 timestamp);
    event Compounded(address indexed user, uint256 indexed stakeId, uint256 reward, uint256 newPrincipal, uint256 timestamp);
    event EmergencyWithdraw(address indexed user, uint256 indexed stakeId, uint256 amount, uint256 penalty, uint256 timestamp);
    event RewardsDeposited(address indexed depositor, uint256 amount, uint256 timestamp);

    // ─── Pool Management (Admin) ───
    function createPool(PoolType poolType, uint256 apyBps, uint256 minStake, uint256 maxStake, uint256 lockDays, uint256 maxCapacity) external returns (uint256 poolId);
    function updatePool(uint256 poolId, uint256 newApyBps, bool active) external;
    function getPool(uint256 poolId) external view returns (
        PoolType poolType, uint256 apyBps, uint256 minStake, uint256 maxStake,
        uint256 lockDays, uint256 totalStaked, uint256 totalStakers,
        uint256 maxCapacity, bool active, uint256 createdAt
    );
    function getTotalPools() external view returns (uint256);

    // ─── Staking ───
    function stake(uint256 poolId, uint256 amount) external returns (uint256 stakeId);
    function unstake(uint256 stakeId) external;
    function claimRewards(uint256 stakeId) external;
    function compound(uint256 stakeId) external;
    function emergencyWithdraw(uint256 stakeId) external;

    // ─── View: Stake Info ───
    function getStakeInfo(uint256 stakeId) external view returns (
        address staker, uint256 poolId, uint256 principal, uint256 pendingReward,
        uint256 stakedAt, uint256 unlockAt, uint256 lastClaimAt,
        StakeStatus status
    );
    function getUserStakes(address user) external view returns (uint256[] memory);
    function getTotalStakes() external view returns (uint256);
    function getPendingReward(uint256 stakeId) external view returns (uint256);

    // ─── View: Platform Stats ───
    function getPlatformStats() external view returns (
        uint256 totalPools, uint256 totalStaked, uint256 totalStakers,
        uint256 totalRewardsPaid, uint256 rewardBalance
    );

    // ─── Rewards Treasury ───
    function depositRewards(uint256 amount) external;
    function setEarlyWithdrawPenaltyBps(uint256 penaltyBps) external;
}
