// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IStudentDAO} from "./interfaces/IStudentDAO.sol";

/**
 * @title StudentDAO
 * @dev Student governance DAO with proposal and voting system
 * Members can create proposals and vote with their voting power
 */
contract StudentDAO is IStudentDAO, Ownable {
    
    // ============ State Variables ============
    uint256 private proposalIdCounter = 1;
    uint256 private votingPeriod = 7 days;
    uint256 private quorumPercentage = 50; // 50%
    
    mapping(uint256 => Proposal) private proposals;
    mapping(address => Member) private members;
    mapping(address => bool) private activemembers;
    mapping(uint256 => mapping(address => bool)) private _hasVoted;
    mapping(uint256 => Vote[]) private proposalVotes;
    
    address[] private memberList;
    uint256[] private proposalList;
    
    uint256 private totalVotingPower = 0;

    // ============ Modifiers ============
    modifier onlyMember() {
        require(activemembers[msg.sender], "Not a member");
        _;
    }

    modifier proposalExists(uint256 proposalId) {
        require(proposals[proposalId].proposalId != 0, "Proposal not found");
        _;
    }

    modifier notVoted(uint256 proposalId) {
        require(!_hasVoted[proposalId][msg.sender], "Already voted");
        _;
    }

    // ============ Constructor ============
    constructor() Ownable(msg.sender) {
        // Owner is automatically a member
        _addMember(msg.sender, 1000e18);
    }

    // ============ Proposal Management ============
    /**
     * @dev Create a new proposal
     */
    function createProposal(
        string calldata title,
        string calldata description,
        string calldata proposalType,
        bytes calldata callData
    ) external onlyMember returns (uint256 proposalId) {
        require(bytes(title).length > 0, "Invalid title");
        require(bytes(description).length > 0, "Invalid description");

        proposalId = proposalIdCounter++;
        
        Proposal storage proposal = proposals[proposalId];
        proposal.proposalId = proposalId;
        proposal.proposer = msg.sender;
        proposal.title = title;
        proposal.description = description;
        proposal.createdAt = block.timestamp;
        proposal.votingEndTime = block.timestamp + votingPeriod;
        proposal.proposalType = proposalType;
        proposal.callData = callData;
        proposal.executed = false;
        proposal.cancelled = false;

        proposalList.push(proposalId);

        // Update member stats
        members[msg.sender].proposalsCreated++;

        emit ProposalCreated(proposalId, msg.sender, title, description, block.timestamp);
    }

    /**
     * @dev Vote on a proposal
     */
    function vote(uint256 proposalId, bool support) 
        external 
        onlyMember 
        proposalExists(proposalId) 
        notVoted(proposalId) 
    {
        Proposal storage proposal = proposals[proposalId];
        require(!proposal.executed && !proposal.cancelled, "Proposal not active");
        require(block.timestamp < proposal.votingEndTime, "Voting period ended");

        uint256 weight = members[msg.sender].votingPower;
        require(weight > 0, "No voting power");

        if (support) {
            proposal.votesFor += weight;
        } else {
            proposal.votesAgainst += weight;
        }

        _hasVoted[proposalId][msg.sender] = true;
        proposalVotes[proposalId].push(Vote({
            voter: msg.sender,
            proposalId: proposalId,
            support: support,
            weight: weight,
            timestamp: block.timestamp
        }));

        members[msg.sender].votesParticipated++;

        emit Voted(proposalId, msg.sender, support, weight);
    }

    /**
     * @dev Execute a proposal if approved
     */
    function executeProposal(uint256 proposalId) 
        external 
        proposalExists(proposalId) 
    {
        Proposal storage proposal = proposals[proposalId];
        require(!proposal.executed, "Already executed");
        require(!proposal.cancelled, "Proposal cancelled");
        require(block.timestamp >= proposal.votingEndTime, "Voting not ended");
        require(proposal.votesFor > proposal.votesAgainst, "Proposal not approved");

        proposal.executed = true;

        // Execute callData if present
        if (proposal.callData.length > 0) {
            // In production, this would require proper authorization
            // For now, we just track execution
        }

        emit ProposalExecuted(proposalId, block.timestamp);
    }

    /**
     * @dev Cancel a proposal
     */
    function cancelProposal(uint256 proposalId) 
        external 
        proposalExists(proposalId) 
    {
        Proposal storage proposal = proposals[proposalId];
        require(!proposal.executed, "Cannot cancel executed proposal");
        require(proposal.proposer == msg.sender || msg.sender == owner(), "Unauthorized");

        proposal.cancelled = true;

        emit ProposalCancelled(proposalId, block.timestamp);
    }

    // ============ Member Management ============
    /**
     * @dev Add a member to the DAO
     */
    function addMember(address member, uint256 votingPower) external onlyOwner {
        _addMember(member, votingPower);
    }

    /**
     * @dev Internal helper to add member
     */
    function _addMember(address member, uint256 votingPower) internal {
        require(member != address(0), "Invalid address");
        require(!activemembers[member], "Already member");
        require(votingPower > 0, "Invalid voting power");

        activemembers[member] = true;
        members[member] = Member({
            memberAddress: member,
            votingPower: votingPower,
            joinDate: block.timestamp,
            isActive: true,
            proposalsCreated: 0,
            votesParticipated: 0
        });

        memberList.push(member);
        totalVotingPower += votingPower;

        emit MemberJoined(member, votingPower, block.timestamp);
    }

    /**
     * @dev Remove a member from the DAO
     */
    function removeMember(address member) external onlyOwner {
        require(activemembers[member], "Not a member");

        uint256 votingPower = members[member].votingPower;
        activemembers[member] = false;
        members[member].isActive = false;
        totalVotingPower -= votingPower;

        emit MemberRemoved(member, block.timestamp);
    }

    /**
     * @dev Update member voting power
     */
    function updateVotingPower(address member, uint256 newVotingPower) external onlyOwner {
        require(activemembers[member], "Not a member");
        require(newVotingPower > 0, "Invalid voting power");

        uint256 oldVotingPower = members[member].votingPower;
        members[member].votingPower = newVotingPower;

        totalVotingPower = totalVotingPower - oldVotingPower + newVotingPower;
    }

    /**
     * @dev Set voting period duration
     */
    function setVotingPeriod(uint256 durationInSeconds) external onlyOwner {
        require(durationInSeconds > 0, "Invalid duration");
        votingPeriod = durationInSeconds;
    }

    /**
     * @dev Set quorum requirement
     */
    function setQuorum(uint256 quorumPercentage_) external onlyOwner {
        require(quorumPercentage_ > 0 && quorumPercentage_ <= 100, "Invalid quorum");
        quorumPercentage = quorumPercentage_;
    }

    // ============ Query Functions ============
    /**
     * @dev Get proposal details
     */
    function getProposal(uint256 proposalId) 
        external 
        view 
        proposalExists(proposalId) 
        returns (Proposal memory) 
    {
        return proposals[proposalId];
    }

    /**
     * @dev Get member details
     */
    function getMember(address member) 
        external 
        view 
        returns (Member memory) 
    {
        require(activemembers[member], "Not a member");
        return members[member];
    }

    /**
     * @dev Check if address is a member
     */
    function isMember(address member) external view returns (bool) {
        return activemembers[member] && members[member].isActive;
    }

    /**
     * @dev Get voting power
     */
    function getVotingPower(address member) external view returns (uint256) {
        return members[member].votingPower;
    }

    /**
     * @dev Check if has voted
     */
    function hasVoted(uint256 proposalId, address member) 
        external 
        view 
        proposalExists(proposalId) 
        returns (bool) 
    {
        return _hasVoted[proposalId][member];
    }

    /**
     * @dev Get total members
     */
    function getTotalMembers() external view returns (uint256) {
        return memberList.length;
    }

    /**
     * @dev Get total proposals
     */
    function getTotalProposals() external view returns (uint256) {
        return proposalList.length;
    }

    /**
     * @dev Get voting period
     */
    function getVotingPeriod() external view returns (uint256) {
        return votingPeriod;
    }

    /**
     * @dev Check if proposal is approved
     */
    function isProposalApproved(uint256 proposalId) 
        external 
        view 
        proposalExists(proposalId) 
        returns (bool) 
    {
        Proposal storage proposal = proposals[proposalId];
        return proposal.votesFor > proposal.votesAgainst;
    }

    /**
     * @dev Get total voting power
     */
    function getTotalVotingPower() external view returns (uint256) {
        return totalVotingPower;
    }

    /**
     * @dev Get active proposals
     */
    function getActiveProposals() external view returns (uint256[] memory) {
        uint256 count = 0;
        
        // Count active proposals
        for (uint256 i = 0; i < proposalList.length; i++) {
            Proposal storage proposal = proposals[proposalList[i]];
            if (!proposal.executed && !proposal.cancelled) {
                count++;
            }
        }

        // Build array
        uint256[] memory activeProposals = new uint256[](count);
        uint256 index = 0;
        
        for (uint256 i = 0; i < proposalList.length; i++) {
            Proposal storage proposal = proposals[proposalList[i]];
            if (!proposal.executed && !proposal.cancelled) {
                activeProposals[index++] = proposalList[i];
            }
        }

        return activeProposals;
    }

    /**
     * @dev Get proposal votes
     */
    function getProposalVotes(uint256 proposalId) 
        external 
        view 
        proposalExists(proposalId) 
        returns (uint256 votesFor, uint256 votesAgainst) 
    {
        Proposal storage proposal = proposals[proposalId];
        return (proposal.votesFor, proposal.votesAgainst);
    }
}
