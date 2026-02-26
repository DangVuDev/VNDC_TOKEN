// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IStaking.sol";

/**
 * @title StakingPool
 * @author VNDC Education Platform
 * @notice Campus staking pool — stake VNDC tokens to earn APY rewards.
 *         Supports flexible & fixed-term pools, compound interest,
 *         early-withdrawal penalties, and an on-chain reward treasury.
 * @dev Module 018 – counters start at 1, Ownable(msg.sender)
 */
contract StakingPool is IStaking, Ownable, ReentrancyGuard {

    // ─── Counters ───
    uint256 public nextPoolId;
    uint256 public nextStakeId;

    // ─── Token & Config ───
    IERC20 public stakingToken;
    uint256 public earlyWithdrawPenaltyBps; // basis-points penalty for early unstake from fixed pool
    uint256 public totalRewardsPaid;
    uint256 public rewardBalance;           // deposited reward treasury
    uint256 public totalPlatformStaked;
    uint256 public totalPlatformStakers;

    // ─── Structs ───
    struct Pool {
        PoolType poolType;
        uint256  apyBps;        // annual yield in basis points (e.g. 1200 = 12%)
        uint256  minStake;
        uint256  maxStake;
        uint256  lockDays;      // 0 for flexible
        uint256  totalStaked;
        uint256  totalStakers;
        uint256  maxCapacity;   // max total staked, 0 = unlimited
        bool     active;
        uint256  createdAt;
    }

    struct StakeRecord {
        address  staker;
        uint256  poolId;
        uint256  principal;
        uint256  stakedAt;
        uint256  unlockAt;
        uint256  lastClaimAt;
        uint256  claimedRewards;
        StakeStatus status;
    }

    // ─── Storage ───
    mapping(uint256 => Pool)        public pools;
    mapping(uint256 => StakeRecord) public stakes;
    mapping(address => uint256[])   private _userStakes;

    // ─── Constructor ───
    constructor(address _stakingToken) Ownable(msg.sender) {
        require(_stakingToken != address(0), "Zero token");
        stakingToken = IERC20(_stakingToken);
        nextPoolId   = 1;
        nextStakeId  = 1;
        earlyWithdrawPenaltyBps = 1000; // 10% default penalty
    }

    // ══════════════════════════════════════════════
    // ─── Admin: Pool Management ───
    // ══════════════════════════════════════════════

    function createPool(
        PoolType poolType,
        uint256 apyBps,
        uint256 minStake,
        uint256 maxStake,
        uint256 lockDays,
        uint256 maxCapacity
    ) external onlyOwner returns (uint256 poolId) {
        require(apyBps > 0 && apyBps <= 50000, "APY 0-500%");
        require(minStake > 0, "Min > 0");

        poolId = nextPoolId++;
        Pool storage p = pools[poolId];
        p.poolType    = poolType;
        p.apyBps      = apyBps;
        p.minStake    = minStake;
        p.maxStake    = maxStake;
        p.lockDays    = lockDays;
        p.maxCapacity = maxCapacity;
        p.active      = true;
        p.createdAt   = block.timestamp;

        emit PoolCreated(poolId, poolType, apyBps, minStake, lockDays, block.timestamp);
    }

    function updatePool(uint256 poolId, uint256 newApyBps, bool active) external onlyOwner {
        Pool storage p = pools[poolId];
        require(p.createdAt > 0, "Pool not found");
        require(newApyBps <= 50000, "APY too high");
        p.apyBps = newApyBps;
        p.active = active;
        emit PoolUpdated(poolId, newApyBps, active, block.timestamp);
    }

    function setEarlyWithdrawPenaltyBps(uint256 penaltyBps) external onlyOwner {
        require(penaltyBps <= 5000, "Max 50%");
        earlyWithdrawPenaltyBps = penaltyBps;
    }

    function depositRewards(uint256 amount) external {
        require(amount > 0, "Zero amount");
        stakingToken.transferFrom(msg.sender, address(this), amount);
        rewardBalance += amount;
        emit RewardsDeposited(msg.sender, amount, block.timestamp);
    }

    // ══════════════════════════════════════════════
    // ─── Staking ───
    // ══════════════════════════════════════════════

    function stake(uint256 poolId, uint256 amount) external nonReentrant returns (uint256 stakeId) {
        Pool storage p = pools[poolId];
        require(p.active, "Pool inactive");
        require(amount >= p.minStake, "Below min");
        require(p.maxStake == 0 || amount <= p.maxStake, "Above max");
        require(p.maxCapacity == 0 || p.totalStaked + amount <= p.maxCapacity, "Pool full");

        stakingToken.transferFrom(msg.sender, address(this), amount);

        stakeId = nextStakeId++;
        StakeRecord storage s = stakes[stakeId];
        s.staker      = msg.sender;
        s.poolId      = poolId;
        s.principal   = amount;
        s.stakedAt    = block.timestamp;
        s.unlockAt    = p.lockDays > 0 ? block.timestamp + (p.lockDays * 1 days) : 0;
        s.lastClaimAt = block.timestamp;
        s.status      = StakeStatus.Active;

        p.totalStaked  += amount;
        p.totalStakers++;
        totalPlatformStaked  += amount;
        totalPlatformStakers++;

        _userStakes[msg.sender].push(stakeId);

        emit Staked(msg.sender, poolId, stakeId, amount, block.timestamp);
    }

    function unstake(uint256 stakeId) external nonReentrant {
        StakeRecord storage s = stakes[stakeId];
        require(s.staker == msg.sender, "Not staker");
        require(s.status == StakeStatus.Active, "Not active");

        Pool storage p = pools[s.poolId];

        // Check lock period
        bool earlyWithdraw = s.unlockAt > 0 && block.timestamp < s.unlockAt;

        // Calculate pending rewards
        uint256 reward = _calculateReward(stakeId);
        uint256 principal = s.principal;
        uint256 penalty;

        if (earlyWithdraw) {
            penalty = (principal * earlyWithdrawPenaltyBps) / 10000;
            principal -= penalty;
            reward = 0; // forfeit rewards on early withdraw
        }

        // Update state
        s.status        = StakeStatus.Unstaked;
        s.lastClaimAt   = block.timestamp;
        s.claimedRewards += reward;
        p.totalStaked   -= s.principal;
        p.totalStakers--;
        totalPlatformStaked -= s.principal;

        // Transfer
        uint256 totalPayout = principal + reward;
        if (reward > 0) {
            require(rewardBalance >= reward, "Insufficient rewards");
            rewardBalance -= reward;
            totalRewardsPaid += reward;
        }
        stakingToken.transfer(msg.sender, totalPayout);

        emit Unstaked(msg.sender, stakeId, principal, reward, block.timestamp);
    }

    function claimRewards(uint256 stakeId) external nonReentrant {
        StakeRecord storage s = stakes[stakeId];
        require(s.staker == msg.sender, "Not staker");
        require(s.status == StakeStatus.Active, "Not active");

        uint256 reward = _calculateReward(stakeId);
        require(reward > 0, "No rewards");
        require(rewardBalance >= reward, "Insufficient rewards");

        s.lastClaimAt    = block.timestamp;
        s.claimedRewards += reward;
        rewardBalance    -= reward;
        totalRewardsPaid += reward;

        stakingToken.transfer(msg.sender, reward);

        emit RewardsClaimed(msg.sender, stakeId, reward, block.timestamp);
    }

    function compound(uint256 stakeId) external nonReentrant {
        StakeRecord storage s = stakes[stakeId];
        require(s.staker == msg.sender, "Not staker");
        require(s.status == StakeStatus.Active, "Not active");

        uint256 reward = _calculateReward(stakeId);
        require(reward > 0, "No rewards");
        require(rewardBalance >= reward, "Insufficient rewards");

        s.lastClaimAt    = block.timestamp;
        s.claimedRewards += reward;
        s.principal      += reward;
        rewardBalance    -= reward;
        totalRewardsPaid += reward;

        Pool storage p = pools[s.poolId];
        p.totalStaked        += reward;
        totalPlatformStaked  += reward;

        emit Compounded(msg.sender, stakeId, reward, s.principal, block.timestamp);
    }

    function emergencyWithdraw(uint256 stakeId) external nonReentrant {
        StakeRecord storage s = stakes[stakeId];
        require(s.staker == msg.sender, "Not staker");
        require(s.status == StakeStatus.Active, "Not active");

        uint256 penalty = (s.principal * earlyWithdrawPenaltyBps) / 10000;
        uint256 payout  = s.principal - penalty;

        Pool storage p = pools[s.poolId];
        p.totalStaked   -= s.principal;
        p.totalStakers--;
        totalPlatformStaked -= s.principal;

        s.status = StakeStatus.Emergency;
        s.lastClaimAt = block.timestamp;

        stakingToken.transfer(msg.sender, payout);

        emit EmergencyWithdraw(msg.sender, stakeId, payout, penalty, block.timestamp);
    }

    // ══════════════════════════════════════════════
    // ─── View Functions ───
    // ══════════════════════════════════════════════

    function getPool(uint256 poolId) external view returns (
        PoolType poolType_, uint256 apyBps_, uint256 minStake_, uint256 maxStake_,
        uint256 lockDays_, uint256 totalStaked_, uint256 totalStakers_,
        uint256 maxCapacity_, bool active_, uint256 createdAt_
    ) {
        Pool storage p = pools[poolId];
        return (p.poolType, p.apyBps, p.minStake, p.maxStake, p.lockDays,
                p.totalStaked, p.totalStakers, p.maxCapacity, p.active, p.createdAt);
    }

    function getTotalPools() external view returns (uint256) {
        return nextPoolId - 1;
    }

    function getStakeInfo(uint256 stakeId) external view returns (
        address staker_, uint256 poolId_, uint256 principal_, uint256 pendingReward_,
        uint256 stakedAt_, uint256 unlockAt_, uint256 lastClaimAt_,
        StakeStatus status_
    ) {
        StakeRecord storage s = stakes[stakeId];
        uint256 pending = s.status == StakeStatus.Active ? _calculateReward(stakeId) : 0;
        return (s.staker, s.poolId, s.principal, pending,
                s.stakedAt, s.unlockAt, s.lastClaimAt, s.status);
    }

    function getUserStakes(address user) external view returns (uint256[] memory) {
        return _userStakes[user];
    }

    function getTotalStakes() external view returns (uint256) {
        return nextStakeId - 1;
    }

    function getPendingReward(uint256 stakeId) external view returns (uint256) {
        StakeRecord storage s = stakes[stakeId];
        if (s.status != StakeStatus.Active) return 0;
        return _calculateReward(stakeId);
    }

    function getPlatformStats() external view returns (
        uint256 totalPools_,
        uint256 totalStaked_,
        uint256 totalStakers_,
        uint256 totalRewardsPaid_,
        uint256 rewardBalance_
    ) {
        return (nextPoolId - 1, totalPlatformStaked, totalPlatformStakers,
                totalRewardsPaid, rewardBalance);
    }

    // ══════════════════════════════════════════════
    // ─── Internal ───
    // ══════════════════════════════════════════════

    /**
     * @dev Calculate pending reward for a stake based on elapsed time and pool APY.
     *      reward = principal * apyBps / 10000 * elapsedSeconds / 365 days
     */
    function _calculateReward(uint256 stakeId) internal view returns (uint256) {
        StakeRecord storage s = stakes[stakeId];
        Pool storage p = pools[s.poolId];

        uint256 elapsed = block.timestamp - s.lastClaimAt;
        if (elapsed == 0 || s.principal == 0) return 0;

        // reward = principal * apyBps * elapsed / (10000 * 365 days)
        return (s.principal * p.apyBps * elapsed) / (10000 * 365 days);
    }
}
