// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IStudentDAO
 * @dev Interface for student governance DAO
 */
interface IStudentDAO {
    // ============ Events ============
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        string title,
        string description,
        uint256 timestamp
    );

    event ProposalExecuted(uint256 indexed proposalId, uint256 timestamp);
    event ProposalCancelled(uint256 indexed proposalId, uint256 timestamp);
    event Voted(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight);
    event VotingPeriodEnded(uint256 indexed proposalId, bool approved, uint256 timestamp);
    event MemberJoined(address indexed member, uint256 votingPower, uint256 timestamp);
    event MemberRemoved(address indexed member, uint256 timestamp);

    // ============ Structs ============
    struct Proposal {
        uint256 proposalId;
        address proposer;
        string title;
        string description;
        uint256 createdAt;
        uint256 votesFor;
        uint256 votesAgainst;
        bool executed;
        bool cancelled;
        uint256 votingEndTime;
        string proposalType; // e.g., "Policy", "Budget", "Election"
        bytes callData; // Encoded function call
    }

    struct Member {
        address memberAddress;
        uint256 votingPower;
        uint256 joinDate;
        bool isActive;
        uint256 proposalsCreated;
        uint256 votesParticipated;
    }

    struct Vote {
        address voter;
        uint256 proposalId;
        bool support;
        uint256 weight;
        uint256 timestamp;
    }

    // ============ Mutation Functions ============
    /**
     * @dev Create a new proposal
     * @param title Proposal title
     * @param description Proposal description
     * @param proposalType Type of proposal
     * @param callData Encoded function call
     * @return proposalId The ID of the created proposal
     */
    function createProposal(
        string calldata title,
        string calldata description,
        string calldata proposalType,
        bytes calldata callData
    ) external returns (uint256 proposalId);

    /**
     * @dev Vote on a proposal
     * @param proposalId Proposal ID
     * @param support True for support, false for against
     */
    function vote(uint256 proposalId, bool support) external;

    /**
     * @dev Execute a proposal if approved
     * @param proposalId Proposal ID
     */
    function executeProposal(uint256 proposalId) external;

    /**
     * @dev Cancel a proposal
     * @param proposalId Proposal ID
     */
    function cancelProposal(uint256 proposalId) external;

    /**
     * @dev Add a member to the DAO
     * @param member Member address
     * @param votingPower Voting power (usually equal to token amount)
     */
    function addMember(address member, uint256 votingPower) external;

    /**
     * @dev Remove a member from the DAO
     * @param member Member address
     */
    function removeMember(address member) external;

    /**
     * @dev Update member voting power
     * @param member Member address
     * @param newVotingPower New voting power
     */
    function updateVotingPower(address member, uint256 newVotingPower) external;

    /**
     * @dev Set voting period duration
     * @param durationInSeconds Duration in seconds
     */
    function setVotingPeriod(uint256 durationInSeconds) external;

    /**
     * @dev Set quorum requirement
     * @param quorumPercentage Quorum as percentage (e.g., 50 = 50%)
     */
    function setQuorum(uint256 quorumPercentage) external;

    // ============ Query Functions ============
    /**
     * @dev Get proposal details
     * @param proposalId Proposal ID
     * @return Proposal structure
     */
    function getProposal(uint256 proposalId) external view returns (Proposal memory);

    /**
     * @dev Get member details
     * @param member Member address
     * @return Member structure
     */
    function getMember(address member) external view returns (Member memory);

    /**
     * @dev Check if address is a member
     * @param member Member address
     * @return true if member is active
     */
    function isMember(address member) external view returns (bool);

    /**
     * @dev Get voting power of member
     * @param member Member address
     * @return Voting power
     */
    function getVotingPower(address member) external view returns (uint256);

    /**
     * @dev Check if member has voted on proposal
     * @param proposalId Proposal ID
     * @param member Member address
     * @return true if member has voted
     */
    function hasVoted(uint256 proposalId, address member) external view returns (bool);

    /**
     * @dev Get total members
     * @return Count of active members
     */
    function getTotalMembers() external view returns (uint256);

    /**
     * @dev Get total proposals
     * @return Count of all proposals
     */
    function getTotalProposals() external view returns (uint256);

    /**
     * @dev Get voting period in seconds
     * @return Duration in seconds
     */
    function getVotingPeriod() external view returns (uint256);

    /**
     * @dev Check if proposal is approved
     * @param proposalId Proposal ID
     * @return true if approved
     */
    function isProposalApproved(uint256 proposalId) external view returns (bool);

    /**
     * @dev Get total voting power in DAO
     * @return Total voting power
     */
    function getTotalVotingPower() external view returns (uint256);

    /**
     * @dev Get all active proposals
     * @return Array of proposal IDs
     */
    function getActiveProposals() external view returns (uint256[] memory);

    /**
     * @dev Get voting results for a proposal
     * @param proposalId Proposal ID
     * @return votesFor Votes in support
     * @return votesAgainst Votes against
     */
    function getProposalVotes(uint256 proposalId) external view returns (uint256 votesFor, uint256 votesAgainst);
}
