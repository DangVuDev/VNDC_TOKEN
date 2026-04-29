// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title VNDCTokenVesting
 * @dev Token vesting contract for VNDC with flexible cliff and vesting schedules
 *
 * Features:
 * - Create vesting schedules with cliff periods
 * - Linear vesting over time
 * - Revocable vesting schedules
 * - Multiple beneficiaries
 */
contract VNDCTokenVesting is ReentrancyGuard {
    // ─────────────────────────────────────────────
    //  State Variables
    // ─────────────────────────────────────────────

    IERC20 public vndc;

    struct VestingSchedule {
        address beneficiary;
        uint256 amount;
        uint256 startTime;
        uint256 cliffTime; // Unix timestamp for cliff end
        uint256 duration; // Total vesting duration in seconds
        uint256 released;
        bool revocable;
        bool revoked;
    }

    mapping(bytes32 => VestingSchedule) public vestingSchedules;
    bytes32[] public vestingScheduleIds;
    mapping(address => bytes32[]) public userVestingSchedules;

    uint256 public totalVested;

    // ─────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────

    event VestingScheduleCreated(
        bytes32 indexed scheduleId,
        address indexed beneficiary,
        uint256 amount,
        uint256 cliffTime,
        uint256 duration,
        bool revocable
    );

    event TokensReleased(
        bytes32 indexed scheduleId,
        address indexed beneficiary,
        uint256 amount
    );

    event VestingScheduleRevoked(
        bytes32 indexed scheduleId,
        uint256 releasedAmount,
        uint256 revokedAmount
    );

    // ─────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────

    constructor(address _vndcToken) {
        require(_vndcToken != address(0), "Invalid token address");
        vndc = IERC20(_vndcToken);
    }

    // ─────────────────────────────────────────────
    //  Vesting Functions
    // ─────────────────────────────────────────────

    /**
     * @dev Create a vesting schedule
     * @param beneficiary The address receiving vested tokens
     * @param amount Total amount to vest
     * @param startTime The start time of the vesting schedule
     * @param cliffDuration Duration of the cliff period in seconds
     * @param vestingDuration Total vesting duration in seconds
     * @param revocable Whether the schedule can be revoked
     * @return scheduleId The ID of the created vesting schedule
     */
    function createVestingSchedule(
        address beneficiary,
        uint256 amount,
        uint256 startTime,
        uint256 cliffDuration,
        uint256 vestingDuration,
        bool revocable
    ) external nonReentrant returns (bytes32) {
        require(beneficiary != address(0), "Invalid beneficiary");
        require(amount > 0, "Amount must be greater than 0");
        require(vestingDuration > 0, "Duration must be greater than 0");
        require(cliffDuration <= vestingDuration, "Cliff > duration");

        // Transfer tokens from owner to this contract
        require(
            vndc.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );

        // Generate schedule ID
        bytes32 scheduleId = keccak256(
            abi.encodePacked(beneficiary, amount, startTime, block.timestamp)
        );

        uint256 cliffTime = startTime + cliffDuration;

        vestingSchedules[scheduleId] = VestingSchedule({
            beneficiary: beneficiary,
            amount: amount,
            startTime: startTime,
            cliffTime: cliffTime,
            duration: vestingDuration,
            released: 0,
            revocable: revocable,
            revoked: false
        });

        vestingScheduleIds.push(scheduleId);
        userVestingSchedules[beneficiary].push(scheduleId);
        totalVested += amount;

        emit VestingScheduleCreated(
            scheduleId,
            beneficiary,
            amount,
            cliffTime,
            vestingDuration,
            revocable
        );

        return scheduleId;
    }

    /**
     * @dev Release vested tokens for a schedule
     * @param scheduleId The ID of the vesting schedule
     * @return The amount of tokens released
     */
    function releaseVestedTokens(bytes32 scheduleId)
        external
        nonReentrant
        returns (uint256)
    {
        VestingSchedule storage schedule = vestingSchedules[scheduleId];
        require(schedule.beneficiary != address(0), "Invalid schedule");
        require(!schedule.revoked, "Schedule revoked");

        uint256 vestedAmount = _calculateVestedAmount(scheduleId);
        uint256 releasableAmount = vestedAmount - schedule.released;

        require(releasableAmount > 0, "Nothing to release");

        schedule.released += releasableAmount;

        require(vndc.transfer(schedule.beneficiary, releasableAmount), "Transfer failed");

        emit TokensReleased(scheduleId, schedule.beneficiary, releasableAmount);

        return releasableAmount;
    }

    /**
     * @dev Revoke a vesting schedule (only if revocable)
     * @param scheduleId The ID of the vesting schedule
     */
    function revokeVestingSchedule(bytes32 scheduleId) external nonReentrant {
        VestingSchedule storage schedule = vestingSchedules[scheduleId];
        require(schedule.beneficiary != address(0), "Invalid schedule");
        require(schedule.revocable, "Not revocable");
        require(!schedule.revoked, "Already revoked");

        schedule.revoked = true;

        uint256 releasedAmount = schedule.released;
        uint256 revokedAmount = schedule.amount - releasedAmount;

        // Return revoked amount to owner
        if (revokedAmount > 0) {
            require(vndc.transfer(msg.sender, revokedAmount), "Transfer failed");
        }

        totalVested -= revokedAmount;

        emit VestingScheduleRevoked(scheduleId, releasedAmount, revokedAmount);
    }

    // ─────────────────────────────────────────────
    //  View Functions
    // ─────────────────────────────────────────────

    /**
     * @dev Calculate vested amount for a schedule
     * @param scheduleId The ID of the vesting schedule
     * @return The vested amount
     */
    function calculateVestedAmount(bytes32 scheduleId)
        external
        view
        returns (uint256)
    {
        return _calculateVestedAmount(scheduleId);
    }

    /**
     * @dev Calculate releasable amount for a schedule
     * @param scheduleId The ID of the vesting schedule
     * @return The releasable amount
     */
    function calculateReleasableAmount(bytes32 scheduleId)
        external
        view
        returns (uint256)
    {
        VestingSchedule storage schedule = vestingSchedules[scheduleId];
        if (schedule.revoked) return 0;

        uint256 vestedAmount = _calculateVestedAmount(scheduleId);
        return vestedAmount - schedule.released;
    }

    /**
     * @dev Get vesting schedule details
     * @param scheduleId The ID of the vesting schedule
     * @return The vesting schedule
     */
    function getVestingSchedule(bytes32 scheduleId)
        external
        view
        returns (VestingSchedule memory)
    {
        return vestingSchedules[scheduleId];
    }

    /**
     * @dev Get all vesting schedules for a user
     * @param user The user address
     * @return An array of schedule IDs
     */
    function getUserVestingSchedules(address user)
        external
        view
        returns (bytes32[] memory)
    {
        return userVestingSchedules[user];
    }

    /**
     * @dev Get total vesting schedules count
     * @return The number of vesting schedules
     */
    function getVestingSchedulesCount() external view returns (uint256) {
        return vestingScheduleIds.length;
    }

    // ─────────────────────────────────────────────
    //  Internal Functions
    // ─────────────────────────────────────────────

    /**
     * @dev Internal function to calculate vested amount
     */
    function _calculateVestedAmount(bytes32 scheduleId)
        internal
        view
        returns (uint256)
    {
        VestingSchedule storage schedule = vestingSchedules[scheduleId];

        // If revoked, return released amount
        if (schedule.revoked) {
            return schedule.released;
        }

        // If cliff not reached, no tokens vested
        if (block.timestamp < schedule.cliffTime) {
            return 0;
        }

        // If vesting complete, all tokens are vested
        uint256 vestingEndTime = schedule.startTime + schedule.duration;
        if (block.timestamp >= vestingEndTime) {
            return schedule.amount;
        }

        // Calculate pro-rata vested amount
        uint256 timeVested = block.timestamp - schedule.startTime;
        uint256 vestedAmount = (schedule.amount * timeVested) / schedule.duration;

        return vestedAmount;
    }
}
