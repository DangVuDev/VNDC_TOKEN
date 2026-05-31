// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title DAOManager
 * @notice Backend-relayed DAO governance contract with proposal lifecycle and weighted voting.
 */
contract DAOManager is Ownable, AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    enum ProposalState {
        Pending,
        Active,
        Defeated,
        Succeeded,
        Queued,
        Executed,
        Cancelled,
        Expired
    }

    struct DAO {
        bytes32 id;
        string name;
        string metadataURI;
        address governanceToken;
        uint256 quorumBps;
        uint64 votingDelay;
        uint64 votingPeriod;
        uint64 timelockDuration;
        bool active;
        uint64 createdAt;
    }

    struct Proposal {
        bytes32 id;
        bytes32 daoId;
        address proposer;
        address target;
        uint256 value;
        bytes data;
        bytes32 descriptionHash;
        uint64 startTime;
        uint64 endTime;
        uint64 eta;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        bool queued;
        bool executed;
        bool cancelled;
    }

    mapping(bytes32 => DAO) public daos;
    mapping(bytes32 => Proposal) public proposals;
    mapping(bytes32 => mapping(address => bool)) public hasVoted;

    event DAOCreated(bytes32 indexed daoId, string name, address indexed governanceToken, address indexed creator);
    event DAOStatusUpdated(bytes32 indexed daoId, bool active);
    event ProposalCreated(bytes32 indexed proposalId, bytes32 indexed daoId, address indexed proposer, address target);
    event VoteCast(bytes32 indexed proposalId, address indexed voter, uint8 support, uint256 weight);
    event ProposalQueued(bytes32 indexed proposalId, uint64 eta);
    event ProposalExecuted(bytes32 indexed proposalId, bytes result);
    event ProposalCancelled(bytes32 indexed proposalId, string reason);

    constructor() Ownable(msg.sender) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }

    function createDAO(
        bytes32 daoId,
        string calldata name,
        string calldata metadataURI,
        address governanceToken,
        uint256 quorumBps,
        uint64 votingDelay,
        uint64 votingPeriod,
        uint64 timelockDuration
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        require(daoId != bytes32(0), "zero dao id");
        require(daos[daoId].id == bytes32(0), "dao exists");
        require(bytes(name).length > 0, "empty name");
        require(governanceToken != address(0), "zero token");
        require(quorumBps > 0 && quorumBps <= 10000, "invalid quorum bps");
        require(votingPeriod > 0, "invalid voting period");

        DAO storage dao = daos[daoId];
        dao.id = daoId;
        dao.name = name;
        dao.metadataURI = metadataURI;
        dao.governanceToken = governanceToken;
        dao.quorumBps = quorumBps;
        dao.votingDelay = votingDelay;
        dao.votingPeriod = votingPeriod;
        dao.timelockDuration = timelockDuration;
        dao.active = true;
        dao.createdAt = uint64(block.timestamp);

        emit DAOCreated(daoId, name, governanceToken, msg.sender);
    }

    function setDAOActive(bytes32 daoId, bool active) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        DAO storage dao = _requireDAO(daoId);
        dao.active = active;
        emit DAOStatusUpdated(daoId, active);
    }

    function createProposal(
        bytes32 proposalId,
        bytes32 daoId,
        address proposer,
        address target,
        uint256 value,
        bytes calldata data,
        bytes32 descriptionHash
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        DAO storage dao = _requireDAO(daoId);
        require(dao.active, "dao inactive");
        require(proposalId != bytes32(0), "zero proposal id");
        require(proposals[proposalId].id == bytes32(0), "proposal exists");
        require(proposer != address(0), "zero proposer");
        require(target != address(0), "zero target");

        uint64 startTime = uint64(block.timestamp) + dao.votingDelay;
        uint64 endTime = startTime + dao.votingPeriod;

        Proposal storage proposal = proposals[proposalId];
        proposal.id = proposalId;
        proposal.daoId = daoId;
        proposal.proposer = proposer;
        proposal.target = target;
        proposal.value = value;
        proposal.data = data;
        proposal.descriptionHash = descriptionHash;
        proposal.startTime = startTime;
        proposal.endTime = endTime;

        emit ProposalCreated(proposalId, daoId, proposer, target);
    }

    function castVote(
        bytes32 proposalId,
        address voter,
        uint8 support,
        uint256 weight
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        Proposal storage p = _requireProposal(proposalId);
        require(voter != address(0), "zero voter");
        require(weight > 0, "zero weight");
        require(support <= 2, "invalid support");
        require(!p.cancelled && !p.executed, "proposal terminal");
        require(block.timestamp >= p.startTime, "voting not started");
        require(block.timestamp <= p.endTime, "voting ended");
        require(!hasVoted[proposalId][voter], "already voted");

        hasVoted[proposalId][voter] = true;

        if (support == 0) {
            p.againstVotes += weight;
        } else if (support == 1) {
            p.forVotes += weight;
        } else {
            p.abstainVotes += weight;
        }

        emit VoteCast(proposalId, voter, support, weight);
    }

    function queueProposal(bytes32 proposalId, uint256 totalVotingPower) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        Proposal storage p = _requireProposal(proposalId);
        DAO storage dao = _requireDAO(p.daoId);

        require(!p.cancelled && !p.executed, "proposal terminal");
        require(!p.queued, "already queued");
        require(block.timestamp > p.endTime, "voting not ended");
        require(totalVotingPower > 0, "invalid voting power");

        uint256 quorumVotes = (totalVotingPower * dao.quorumBps) / 10000;
        uint256 participatingVotes = p.forVotes + p.againstVotes + p.abstainVotes;

        require(participatingVotes >= quorumVotes, "quorum not met");
        require(p.forVotes > p.againstVotes, "proposal defeated");

        p.queued = true;
        p.eta = uint64(block.timestamp) + dao.timelockDuration;

        emit ProposalQueued(proposalId, p.eta);
    }

    function executeProposal(bytes32 proposalId) external onlyRole(OPERATOR_ROLE) nonReentrant whenNotPaused returns (bytes memory) {
        Proposal storage p = _requireProposal(proposalId);
        require(p.queued, "proposal not queued");
        require(!p.executed, "already executed");
        require(!p.cancelled, "proposal cancelled");
        require(block.timestamp >= p.eta, "timelock not elapsed");

        p.executed = true;
        (bool ok, bytes memory result) = p.target.call{value: p.value}(p.data);
        require(ok, "proposal execution failed");

        emit ProposalExecuted(proposalId, result);
        return result;
    }

    function cancelProposal(bytes32 proposalId, string calldata reason) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        Proposal storage p = _requireProposal(proposalId);
        require(!p.executed, "already executed");
        require(!p.cancelled, "already cancelled");

        p.cancelled = true;
        emit ProposalCancelled(proposalId, reason);
    }

    function proposalState(bytes32 proposalId) external view returns (ProposalState) {
        Proposal storage p = _requireProposal(proposalId);
        if (p.cancelled) {
            return ProposalState.Cancelled;
        }
        if (p.executed) {
            return ProposalState.Executed;
        }
        if (block.timestamp < p.startTime) {
            return ProposalState.Pending;
        }
        if (block.timestamp <= p.endTime) {
            return ProposalState.Active;
        }
        if (p.queued) {
            if (block.timestamp > p.eta + 30 days) {
                return ProposalState.Expired;
            }
            return ProposalState.Queued;
        }
        if (p.forVotes <= p.againstVotes) {
            return ProposalState.Defeated;
        }
        return ProposalState.Succeeded;
    }

    function _requireDAO(bytes32 daoId) internal view returns (DAO storage) {
        DAO storage dao = daos[daoId];
        require(dao.id != bytes32(0), "dao not found");
        return dao;
    }

    function _requireProposal(bytes32 proposalId) internal view returns (Proposal storage) {
        Proposal storage p = proposals[proposalId];
        require(p.id != bytes32(0), "proposal not found");
        return p;
    }

    receive() external payable {}
}
