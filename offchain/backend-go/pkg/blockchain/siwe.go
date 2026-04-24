// Package blockchain — SIWE (Sign-In With Ethereum) helpers.
// Implements EIP-191 personal_sign message hashing and wallet address recovery.
package blockchain

import (
	"fmt"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

// SIWEMessage builds a human-readable Sign-In With Ethereum message.
// nonce should be a cryptographically random value stored server-side.
func SIWEMessage(domain, address, nonce, issuedAt string) string {
	return fmt.Sprintf(
		"%s wants you to sign in with your Ethereum account:\n%s\n\nSign in to VNDC Platform\n\nNonce: %s\nIssued At: %s",
		domain, address, nonce, issuedAt,
	)
}

// PersonalSignHash computes the Ethereum personal_sign prefixed hash (EIP-191).
// This matches what MetaMask and other wallets produce when calling
// eth_sign / personal_sign.
func PersonalSignHash(message string) common.Hash {
	prefix := fmt.Sprintf("\x19Ethereum Signed Message:\n%d", len(message))
	return crypto.Keccak256Hash([]byte(prefix), []byte(message))
}

// RecoverPersonalSigner recovers the Ethereum address that signed message
// with personal_sign (EIP-191). sig must be 65 bytes [R || S || V].
// V is adjusted from 27/28 to 0/1 automatically.
func RecoverPersonalSigner(message string, sig []byte) (common.Address, error) {
	if len(sig) != 65 {
		return common.Address{}, fmt.Errorf("siwe: signature must be 65 bytes, got %d", len(sig))
	}

	// Normalise recovery bit: MetaMask returns V=27/28, crypto.SigToPub expects V=0/1.
	sigCopy := make([]byte, 65)
	copy(sigCopy, sig)
	if sigCopy[64] >= 27 {
		sigCopy[64] -= 27
	}

	hash := PersonalSignHash(message)
	pubKey, err := crypto.SigToPub(hash.Bytes(), sigCopy)
	if err != nil {
		return common.Address{}, fmt.Errorf("siwe: recover public key: %w", err)
	}
	return crypto.PubkeyToAddress(*pubKey), nil
}

// VerifySIWE verifies that sig was produced by expectedAddress signing message.
func VerifySIWE(message string, sig []byte, expectedAddress common.Address) (bool, error) {
	recovered, err := RecoverPersonalSigner(message, sig)
	if err != nil {
		return false, err
	}
	return recovered == expectedAddress, nil
}
