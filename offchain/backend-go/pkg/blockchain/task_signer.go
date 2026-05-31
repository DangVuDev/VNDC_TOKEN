// Package blockchain — TaskManager EIP-712 signer.
// Signs ClaimReward structs so the backend can prove it approved a given claim.
// The TaskManager contract is called directly by the backend owner key; this
// signer generates the authorisation record for audit / future on-chain verification.
package blockchain

import (
	"crypto/ecdsa"
	"encoding/hex"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/math"
	"github.com/ethereum/go-ethereum/crypto"

	apperr "github.com/vndc/backend/pkg/errors"
)

// ─────────────────────────────────────────────
//  ClaimRewardData — EIP-712 struct
// ─────────────────────────────────────────────

// ClaimRewardTypeStr is the EIP-712 type string for a task claim authorisation.
const ClaimRewardTypeStr = "ClaimReward(bytes32 taskId,address student,uint256 rewardAmount,uint256 nonce,uint256 deadline)"

var ClaimRewardTypeHash = crypto.Keccak256Hash([]byte(ClaimRewardTypeStr))

// ClaimRewardData holds the payload that the TaskSigner signs.
type ClaimRewardData struct {
	TaskID       [32]byte
	Student      common.Address
	RewardAmount *big.Int
	Nonce        *big.Int
	Deadline     *big.Int
}

// Hash computes the EIP-712 struct hash for ClaimRewardData.
func (c ClaimRewardData) Hash() [32]byte {
	encoded := make([]byte, 0, 192)
	encoded = append(encoded, ClaimRewardTypeHash.Bytes()...)
	encoded = append(encoded, c.TaskID[:]...)
	encoded = append(encoded, common.LeftPadBytes(c.Student.Bytes(), 32)...)
	encoded = append(encoded, math.U256Bytes(c.RewardAmount)...)
	encoded = append(encoded, math.U256Bytes(c.Nonce)...)
	encoded = append(encoded, math.U256Bytes(c.Deadline)...)
	return crypto.Keccak256Hash(encoded)
}

// ─────────────────────────────────────────────
//  TaskSigner
// ─────────────────────────────────────────────

// TaskSigner signs claim authorisations using the backend's task-signer key.
// This key is the contract owner's key (used to call claimReward on-chain).
type TaskSigner struct {
	privKey *ecdsa.PrivateKey
	address common.Address
	domain  Domain
}

// NewTaskSigner creates a TaskSigner from a hex-encoded private key.
// The domain should use "TaskManager" as name.
func NewTaskSigner(hexPrivKey string, domain Domain) (*TaskSigner, error) {
	if hexPrivKey == "" {
		return nil, apperr.New(apperr.ErrCodeInternal, "task signer private key is required")
	}
	privKey, err := HexToPrivateKey(hexPrivKey)
	if err != nil {
		return nil, fmt.Errorf("task signer: %w", err)
	}
	return &TaskSigner{
		privKey: privKey,
		address: AddressFromPrivateKey(privKey),
		domain:  domain,
	}, nil
}

// Address returns the Ethereum address derived from the signer's key.
func (s *TaskSigner) Address() common.Address { return s.address }

// SignClaim generates the EIP-712 authorisation signature for a claim.
//
//	taskIdHex   — 0x-prefixed 32-byte hex (onchain_task_id)
//	studentAddr — student's wallet address
//	rewardWei   — reward in wei (*big.Int)
//	nonce       — unique nonce (*big.Int)
//	deadline    — Unix timestamp (*big.Int)
//
// Returns a 0x-prefixed hex string of the 65-byte (r,s,v) signature.
func (s *TaskSigner) SignClaim(taskIdHex string, studentAddr common.Address, rewardWei, nonce, deadline *big.Int) (string, error) {
	taskId, err := hexToBytes32(taskIdHex)
	if err != nil {
		return "", apperr.Wrap(apperr.ErrCodeBadRequest, "invalid task id hex", err)
	}
	data := ClaimRewardData{
		TaskID:       taskId,
		Student:      studentAddr,
		RewardAmount: rewardWei,
		Nonce:        nonce,
		Deadline:     deadline,
	}
	digest := Digest(s.domain, data)
	sig, err := SignDigest(digest, s.privKey)
	if err != nil {
		return "", err
	}
	return "0x" + hex.EncodeToString(sig), nil
}

// hexToBytes32 converts a 0x-prefixed or raw hex string to [32]byte.
func hexToBytes32(h string) ([32]byte, error) {
	if len(h) >= 2 && h[:2] == "0x" {
		h = h[2:]
	}
	b, err := hex.DecodeString(h)
	if err != nil || len(b) > 32 {
		return [32]byte{}, fmt.Errorf("hex decode: %w", err)
	}
	var out [32]byte
	copy(out[32-len(b):], b)
	return out, nil
}
