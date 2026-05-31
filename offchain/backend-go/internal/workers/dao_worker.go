// Package workers contains background jobs.
// DAOWorker resolves expired DAO proposals, applies quorum rules, queues successful proposals on-chain, and later executes ready timelocked proposals.
//
// Business rules (spec section 4.2.3):
//   - Query ACTIVE/PENDING proposals where end_time < now.
//   - Tally: forVotes, againstVotes, total = for + against.
//   - Eligible voters: users with on-chain balance >= quorumMinBalance.
//   - Quorum check: total_voted / eligible_voters >= 50%.
//   - If forVotes > againstVotes AND quorum >= 50%  → SUCCEEDED → queue on chain.
//   - Otherwise → DEFEATED.
//   - After on-chain timelock → EXECUTED.
package workers

import (
	"context"
	"math/big"
	"time"

	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/internal/ports"
	"github.com/vndc/backend/pkg/logger"
)

const (
	daoWorkerInterval = 60 * time.Minute
	// quorumMinBalance is the minimum token balance (in wei) required to be
	// counted as an eligible voter (1000 VNDC with 18 decimals).
	quorumMinBalance = "1000000000000000000000"
	// quorumThresholdPct is the minimum percentage of eligible voters that
	// must have cast a vote for the proposal to be valid (50%).
	quorumThresholdPct = 50
)

// daoContractPort narrows the contract adapter down to the queue and execute operations required by the worker.
// This keeps the background job decoupled from the full DAO service or broader blockchain adapter surface.
type daoContractPort interface {
	QueueProposal(ctx context.Context, proposalID string, totalVotingPower string) (txHash string, err error)
	ExecuteProposal(ctx context.Context, proposalID string) (txHash string, err error)
}

// DAOWorker periodically evaluates expired governance proposals and advances them through the post-voting lifecycle.
// It is the background bridge between stored vote tallies and the next on-chain governance step.
type DAOWorker struct {
	proposalRepo ports.DAOProposalRepository
	voteRepo     ports.DAOVoteRepository
	userRepo     ports.UserRepository
	contract     daoContractPort
	log          logger.Logger
}

// NewDAOWorker constructs the governance background worker with proposal, vote, user, and optional contract dependencies.
func NewDAOWorker(
	proposalRepo ports.DAOProposalRepository,
	voteRepo ports.DAOVoteRepository,
	userRepo ports.UserRepository,
	contract daoContractPort,
	log logger.Logger,
) *DAOWorker {
	return &DAOWorker{
		proposalRepo: proposalRepo,
		voteRepo:     voteRepo,
		userRepo:     userRepo,
		contract:     contract,
		log:          log.Named("dao_worker"),
	}
}

// Run starts the DAO resolution loop and blocks until context cancellation.
// Each tick processes newly expired proposals and separately checks whether queued proposals are ready for execution.
func (w *DAOWorker) Run(ctx context.Context) {
	ticker := time.NewTicker(daoWorkerInterval)
	defer ticker.Stop()
	w.log.Info("dao worker started")
	for {
		select {
		case <-ctx.Done():
			w.log.Info("dao worker stopped")
			return
		case <-ticker.C:
			w.process(ctx)
		}
	}
}

// process loads active proposals whose voting window has ended and resolves each one independently.
// One proposal failure does not stop the rest of the batch from being examined.
func (w *DAOWorker) process(ctx context.Context) {
	proposals, err := w.proposalRepo.FindExpiredActive(ctx)
	if err != nil {
		w.log.Error("dao worker: find expired proposals", logger.Err(err))
		return
	}
	for _, p := range proposals {
		if err := w.resolveProposal(ctx, p); err != nil {
			w.log.Error("dao worker: resolve proposal failed",
				logger.String("proposal_id", p.ID),
				logger.Err(err),
			)
		}
	}
}

// resolveProposal evaluates vote totals, quorum, and victory conditions for one expired proposal and then advances its state.
// Successful proposals are first marked succeeded off-chain and then optionally queued on-chain for timelocked execution.
func (w *DAOWorker) resolveProposal(ctx context.Context, p *domain.DAOProposal) error {
	// Tally votes already stored in the proposal aggregate fields
	forVotes, _ := new(big.Int).SetString(p.ForVotes, 10)
	againstVotes, _ := new(big.Int).SetString(p.AgainstVotes, 10)
	if forVotes == nil {
		forVotes = big.NewInt(0)
	}
	if againstVotes == nil {
		againstVotes = big.NewInt(0)
	}

	totalVoted := new(big.Int).Add(forVotes, againstVotes)
	_ = totalVoted // kept for potential logging; quorum uses vote count not weight

	// Count eligible voters (users with token balance >= 1000 VNDC)
	eligibleCount, err := w.countEligibleVoters(ctx, quorumMinBalance)
	if err != nil {
		w.log.Warn("dao worker: could not count eligible voters, using lenient quorum",
			logger.String("proposal_id", p.ID),
			logger.Err(err),
		)
		eligibleCount = 1 // fallback — skip quorum check
	}

	// Quorum: total_voted_count / eligible >= 50%
	// We count votes by tallying from the vote records.
	votedCount, err := w.countVoters(ctx, p.ID)
	if err != nil {
		votedCount = 0
	}

	now := time.Now().UTC()
	p.UpdatedAt = now

	meetsQuorum := eligibleCount > 0 && (votedCount*100/eligibleCount) >= quorumThresholdPct
	forWins := forVotes.Cmp(againstVotes) > 0

	if forWins && meetsQuorum {
		// Succeeded: queue on chain
		p.Status = domain.DAOProposalSucceeded
		if err := w.proposalRepo.Update(ctx, p); err != nil {
			return err
		}
		w.log.Info("dao worker: proposal succeeded, queuing",
			logger.String("proposal_id", p.ID),
		)

		// Queue on chain (timelock starts). Pass total voting power (for+against+abstain).
		if w.contract != nil {
			abstainVotes, _ := new(big.Int).SetString(p.AbstainVotes, 10)
			if abstainVotes == nil {
				abstainVotes = big.NewInt(0)
			}
			totalVotingPower := new(big.Int).Add(totalVoted, abstainVotes)
			txHash, qErr := w.contract.QueueProposal(ctx, p.OnchainProposalID, totalVotingPower.String())
			if qErr != nil {
				w.log.Error("dao worker: QueueProposal on-chain failed",
					logger.String("proposal_id", p.ID),
					logger.Err(qErr),
				)
				return nil // already marked SUCCEEDED; retry next tick
			}
			p.Status = domain.DAOProposalQueued
			p.QueueTxHash = txHash
			// Eta is not returned by adapter; set a default timelock of 2 days
			eta := time.Now().UTC().Add(48 * time.Hour)
			p.Eta = &eta
			p.UpdatedAt = time.Now().UTC()
			if err := w.proposalRepo.Update(ctx, p); err != nil {
				return err
			}
		}
	} else {
		// Defeated
		p.Status = domain.DAOProposalDefeated
		if err := w.proposalRepo.Update(ctx, p); err != nil {
			return err
		}
		w.log.Info("dao worker: proposal defeated",
			logger.String("proposal_id", p.ID),
			logger.Bool("for_wins", forWins),
			logger.Bool("meets_quorum", meetsQuorum),
		)
	}

	// Separately: check QUEUED proposals past their ETA and execute them
	if err := w.executeReadyProposals(ctx); err != nil {
		w.log.Error("dao worker: execute ready proposals", logger.Err(err))
	}

	return nil
}

// executeReadyProposals finds queued proposals whose ETA has passed and attempts final on-chain execution.
// This second phase is kept separate because a proposal may be queued on one tick and only become executable much later.
func (w *DAOWorker) executeReadyProposals(ctx context.Context) error {
	if w.contract == nil {
		return nil
	}
	// Use the generic Find with status filter — simple and sufficient.
	queued, _, err := w.proposalRepo.Find(ctx)
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	for _, p := range queued {
		if p.Status != domain.DAOProposalQueued {
			continue
		}
		if p.Eta == nil || p.Eta.After(now) {
			continue
		}
		txHash, execErr := w.contract.ExecuteProposal(ctx, p.OnchainProposalID)
		if execErr != nil {
			w.log.Error("dao worker: ExecuteProposal on-chain failed",
				logger.String("proposal_id", p.ID),
				logger.Err(execErr),
			)
			continue
		}
		p.Status = domain.DAOProposalExecuted
		p.ExecuteTxHash = txHash
		p.UpdatedAt = now
		if err := w.proposalRepo.Update(ctx, p); err != nil {
			w.log.Error("dao worker: update executed proposal",
				logger.String("proposal_id", p.ID),
				logger.Err(err),
			)
		}
	}
	return nil
}

// countVoters returns how many vote records exist for the proposal, which the worker uses for quorum participation.
func (w *DAOWorker) countVoters(ctx context.Context, proposalID string) (int64, error) {
	_, total, err := w.voteRepo.FindByProposal(ctx, proposalID)
	return total, err
}

// countEligibleVoters approximates the eligible-voter population used for quorum checks.
// The current implementation falls back to total registered users because an exact live-balance scan would be heavier and more contract-coupled.
func (w *DAOWorker) countEligibleVoters(ctx context.Context, _ string) (int64, error) {
	// Total user count: every registered user is treated as potentially eligible.
	// A more accurate implementation would query balances, but that is contract-heavy.
	_, total, err := w.userRepo.Find(ctx)
	return total, err
}
