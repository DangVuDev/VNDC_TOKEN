// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title VNDC_Governance
 * @notice DAO-style governance for VNDC ecosystem decisions
 * @dev Uses OpenZeppelin Governor framework with VNDC token voting
 * @author VNDC Team
 */
contract VNDC_Governance is
    Governor,
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorVotesQuorumFraction,
    AccessControl
{
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");

    // ===== EVENTS =====
    event ProposalThresholdUpdated(uint256 newThreshold);

    /**
     * @notice Initialize VNDC Governance
     * @param _token Address of VNDC token (IVotes)
     * 
     * Governor Configuration:
     * - votingDelay: 1 block (voting starts 1 block after proposal)
     * - votingPeriod: 50400 blocks (~1 week on Polygon)
     * - proposalThreshold: 1000 VNDC tokens required to propose
     * - quorumNumeratorValue: 4% of voting power required
     */
    constructor(IVotes _token)
        Governor("VNDC Governance")
        GovernorSettings(
            1,           // 1 block voting delay
            50400,       // 1 week voting period (blocks)
            1000e18      // 1000 VNDC tokens to propose
        )
        GovernorVotes(_token)
        GovernorVotesQuorumFraction(4)
    {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(PROPOSER_ROLE, msg.sender);
    }

    // ===== PROPOSAL FUNCTIONS =====

    /**
     * @notice Create a new governance proposal
     * @param targets Array of target contract addresses
     * @param values Array of ETH values to send
     * @param calldatas Array of function call data
     * @param description Description of proposal
     * @return proposalId ID of created proposal
     * 
     * @dev Standard Governor propose() with role check
     * 
     * Example:
     * - targets: [tokenAddress]
     * - values: [0]
     * - calldatas: [abi.encodeWithSignature("mint(address,uint256)", student, amount)]
     * - description: "Mint 1000 VNDC to top students"
     */
    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public override returns (uint256) {
        require(
            hasRole(PROPOSER_ROLE, msg.sender),
            "Must have proposer role"
        );
        return super.propose(targets, values, calldatas, description);
    }

    /**
     * @notice Allow anyone to propose (if they have enough VNDC)
     * @dev Override to use only proposalThreshold check
     */
    function proposalThreshold()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.proposalThreshold();
    }

    /**
     * @notice Get proposal state
     * @param proposalId ID of proposal
     * @return State of proposal (Pending, Active, Canceled, Defeated, Succeeded, Queued, Expired, Executed)
     */
    function getProposalState(uint256 proposalId)
        public
        view
        returns (string memory)
    {
        if (state(proposalId) == ProposalState.Pending) return "Pending";
        if (state(proposalId) == ProposalState.Active) return "Active";
        if (state(proposalId) == ProposalState.Canceled) return "Canceled";
        if (state(proposalId) == ProposalState.Defeated) return "Defeated";
        if (state(proposalId) == ProposalState.Succeeded) return "Succeeded";
        if (state(proposalId) == ProposalState.Queued) return "Queued";
        if (state(proposalId) == ProposalState.Expired) return "Expired";
        if (state(proposalId) == ProposalState.Executed) return "Executed";
        return "Unknown";
    }

    /**
     * @notice Get proposal details
     * @param proposalId ID of proposal
     * @return id Proposal ID
     * @return proposer Creator of proposal
     * @return eta Execution time (if queued)
     * @return startBlock Block voting starts
     * @return endBlock Block voting ends
     * @return forVotes Votes in favor
     * @return againstVotes Votes against
     * @return abstainVotes Abstain votes
     * @return canceled Whether proposal was canceled
     * @return executed Whether proposal was executed
     */
    function getProposalDetails(uint256 proposalId)
        public
        view
        returns (
            uint256 id,
            address proposer,
            uint256 eta,
            uint256 startBlock,
            uint256 endBlock,
            uint256 forVotes,
            uint256 againstVotes,
            uint256 abstainVotes,
            bool canceled,
            bool executed
        )
    {
        (id, proposer, eta, startBlock, endBlock, forVotes, againstVotes, abstainVotes, canceled, executed) = proposalDetails(proposalId);
    }

    /**
     * @notice Get voting weight at specific block
     * @param account Address to check
     * @param blockNumber Block number
     * @return Voting power (in VNDC)
     */
    function getVotingPower(address account, uint256 blockNumber)
        public
        view
        returns (uint256)
    {
        return getVotes(account, blockNumber);
    }

    // ===== VOTING FUNCTIONS =====

    /**
     * @notice Cast a vote on a proposal
     * @param proposalId ID of proposal
     * @param support Vote type (0=Against, 1=For, 2=Abstain)
     * @param reason Reason for vote
     * @return voteWeight Voting power used
     */
    function castVoteWithReasonAndParams(
        uint256 proposalId,
        uint8 support,
        string calldata reason,
        bytes memory params
    ) public override returns (uint256) {
        return super.castVoteWithReasonAndParams(proposalId, support, reason, params);
    }

    /**
     * @notice Check if account has voted
     * @param proposalId ID of proposal
     * @param account Address to check
     * @return Whether account voted
     */
    function hasVoted(uint256 proposalId, address account)
        public
        view
        override
        returns (bool)
    {
        return super.hasVoted(proposalId, account);
    }

    /**
     * @notice Get votes cast on proposal
     * @param proposalId ID of proposal
     * @return forVotes Votes in favor
     * @return againstVotes Votes against
     * @return abstainVotes Abstain votes
     */
    function proposalVotes(uint256 proposalId)
        public
        view
        returns (
            uint256 forVotes,
            uint256 againstVotes,
            uint256 abstainVotes
        )
    {
        (againstVotes, forVotes, abstainVotes) = proposalVotes(proposalId);
    }

    // ===== EXECUTION FUNCTIONS =====

    /**
     * @notice Queue a succeeded proposal for execution
     * @param targets Array of target contracts
     * @param values Array of ETH values
     * @param calldatas Array of function calls
     * @param descriptionHash Hash of proposal description
     */
    function queue(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) public override returns (uint256) {
        return super.queue(targets, values, calldatas, descriptionHash);
    }

    /**
     * @notice Execute a queued proposal
     * @param targets Array of target contracts
     * @param values Array of ETH values
     * @param calldatas Array of function calls
     * @param descriptionHash Hash of proposal description
     */
    function execute(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) public payable override returns (uint256) {
        return super.execute(targets, values, calldatas, descriptionHash);
    }

    // ===== ADMIN FUNCTIONS =====

    /**
     * @notice Grant proposer role
     * @param account Address to grant role
     */
    function grantProposerRole(address account)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        grantRole(PROPOSER_ROLE, account);
    }

    /**
     * @notice Revoke proposer role
     * @param account Address to revoke role
     */
    function revokeProposerRole(address account)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        revokeRole(PROPOSER_ROLE, account);
    }

    /**
     * @notice Update quorum percentage
     * @param newQuorumNumerator New quorum numerator (e.g., 4 = 4%)
     */
    function updateQuorum(uint256 newQuorumNumerator)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _updateQuorumNumerator(newQuorumNumerator);
    }

    /**
     * @notice Update voting delay
     * @param newVotingDelay New voting delay in blocks
     */
    function updateVotingDelay(uint48 newVotingDelay)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _setGovernorSettings(newVotingDelay, votingPeriod(), proposalThreshold());
    }

    /**
     * @notice Update voting period
     * @param newVotingPeriod New voting period in blocks
     */
    function updateVotingPeriod(uint32 newVotingPeriod)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _setGovernorSettings(votingDelay(), newVotingPeriod, proposalThreshold());
    }

    /**
     * @notice Update proposal threshold
     * @param newThreshold New minimum VNDC to propose
     */
    function updateProposalThreshold(uint256 newThreshold)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _setGovernorSettings(votingDelay(), votingPeriod(), newThreshold);
        emit ProposalThresholdUpdated(newThreshold);
    }

    // ===== REQUIRED OVERRIDES =====

    function quorumNumerator(uint256 blockNumber)
        public
        view
        override(GovernorVotesQuorumFraction)
        returns (uint256)
    {
        return super.quorumNumerator(blockNumber);
    }

    function state(uint256 proposalId)
        public
        view
        override(Governor)
        returns (ProposalState)
    {
        return super.state(proposalId);
    }

    function proposalNeedsQueuing(uint256 proposalId)
        public
        view
        override(Governor)
        returns (bool)
    {
        return super.proposalNeedsQueuing(proposalId);
    }

    function proposalDeadline(uint256 proposalId)
        public
        view
        override(Governor)
        returns (uint256)
    {
        return super.proposalDeadline(proposalId);
    }

    function votingDelay()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.votingDelay();
    }

    function votingPeriod()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.votingPeriod();
    }

    function quorum(uint256 blockNumber)
        public
        view
        override(Governor, GovernorVotesQuorumFraction)
        returns (uint256)
    {
        return super.quorum(blockNumber);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(Governor, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function castVote(uint256 proposalId, uint8 support)
        public
        override
        returns (uint256)
    {
        return super.castVote(proposalId, support);
    }

    function castVoteWithReason(
        uint256 proposalId,
        uint8 support,
        string calldata reason
    ) public override returns (uint256) {
        return super.castVoteWithReason(proposalId, support, reason);
    }
}
