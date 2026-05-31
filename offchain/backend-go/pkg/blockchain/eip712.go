// Package blockchain — EIP-712 typed data signing and verification.
// Used for meta-transactions: user signs off-chain, relayer submits on-chain.
// Reference: https://eips.ethereum.org/EIPS/eip-712
package blockchain

import (
	"crypto/ecdsa"
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/math"
	"github.com/ethereum/go-ethereum/crypto"

	apperr "github.com/vndc/backend/pkg/errors"
)

// ─────────────────────────────────────────────
//  EIP-712 Domain
// ─────────────────────────────────────────────

// Domain represents the EIP-712 domain separator fields.
type Domain struct {
	Name              string
	Version           string
	ChainID           *big.Int
	VerifyingContract common.Address
}

// Separator computes the EIP-712 domain separator hash.
// Formula: keccak256(abi.encode(typeHash, name, version, chainId, verifyingContract))
func (d Domain) Separator() [32]byte {
	typeHash := crypto.Keccak256Hash([]byte(
		"EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)",
	))

	nameHash := crypto.Keccak256Hash([]byte(d.Name))
	versionHash := crypto.Keccak256Hash([]byte(d.Version))

	encoded := make([]byte, 0, 160)
	encoded = append(encoded, typeHash.Bytes()...)
	encoded = append(encoded, nameHash.Bytes()...)
	encoded = append(encoded, versionHash.Bytes()...)
	encoded = append(encoded, math.U256Bytes(new(big.Int).Set(d.ChainID))...)
	encoded = append(encoded, common.LeftPadBytes(d.VerifyingContract.Bytes(), 32)...)

	return crypto.Keccak256Hash(encoded)
}

// ─────────────────────────────────────────────
//  Transfer TypeHash (VNDC ERC20 meta-transfer)
// ─────────────────────────────────────────────

const TransferTypeStr = "Transfer(address from,address to,uint256 amount,uint256 nonce,uint256 deadline)"

var TransferTypeHash = crypto.Keccak256Hash([]byte(TransferTypeStr))

// TransferData contains the meta-transaction payload.
type TransferData struct {
	From     common.Address
	To       common.Address
	Amount   *big.Int
	Nonce    *big.Int
	Deadline *big.Int
}

// Hash computes the EIP-712 struct hash for TransferData.
func (t TransferData) Hash() [32]byte {
	encoded := make([]byte, 0, 160)
	encoded = append(encoded, TransferTypeHash.Bytes()...)
	encoded = append(encoded, common.LeftPadBytes(t.From.Bytes(), 32)...)
	encoded = append(encoded, common.LeftPadBytes(t.To.Bytes(), 32)...)
	encoded = append(encoded, math.U256Bytes(t.Amount)...)
	encoded = append(encoded, math.U256Bytes(t.Nonce)...)
	encoded = append(encoded, math.U256Bytes(t.Deadline)...)
	return crypto.Keccak256Hash(encoded)
}

// ─────────────────────────────────────────────
//  NFT Mint TypeHash (ERC1155 meta-mint)
// ─────────────────────────────────────────────

const MintTypeStr = "Mint(address to,uint256 tokenId,uint256 amount,bytes32 metadataHash,uint256 nonce,uint256 deadline)"

var MintTypeHash = crypto.Keccak256Hash([]byte(MintTypeStr))

// MintData contains the meta-transaction payload for NFT minting.
type MintData struct {
	To           common.Address
	TokenID      *big.Int
	Amount       *big.Int
	MetadataHash [32]byte
	Nonce        *big.Int
	Deadline     *big.Int
}

// Hash computes the EIP-712 struct hash for MintData.
func (m MintData) Hash() [32]byte {
	encoded := make([]byte, 0, 192)
	encoded = append(encoded, MintTypeHash.Bytes()...)
	encoded = append(encoded, common.LeftPadBytes(m.To.Bytes(), 32)...)
	encoded = append(encoded, math.U256Bytes(m.TokenID)...)
	encoded = append(encoded, math.U256Bytes(m.Amount)...)
	encoded = append(encoded, m.MetadataHash[:]...)
	encoded = append(encoded, math.U256Bytes(m.Nonce)...)
	encoded = append(encoded, math.U256Bytes(m.Deadline)...)
	return crypto.Keccak256Hash(encoded)
}

// ─────────────────────────────────────────────
//  EIP-712 digest & signature verification
// ─────────────────────────────────────────────

// Hasher is implemented by all struct types that can produce an EIP-712 struct hash.
type Hasher interface {
	Hash() [32]byte
}

// Digest computes the final EIP-712 hash-to-sign.
// Formula: keccak256("\x19\x01" || domainSeparator || structHash)
func Digest(domain Domain, data Hasher) []byte {
	sep := domain.Separator()
	structHash := data.Hash()

	raw := make([]byte, 0, 66)
	raw = append(raw, 0x19, 0x01)
	raw = append(raw, sep[:]...)
	raw = append(raw, structHash[:]...)

	return crypto.Keccak256(raw)
}

// RecoverSigner recovers the Ethereum address from an EIP-712 digest and signature.
// sig must be 65 bytes (r, s, v) with v = 27 or 28 (Ethereum convention).
func RecoverSigner(digest []byte, sig []byte) (common.Address, error) {
	if len(sig) != 65 {
		return common.Address{}, apperr.New(apperr.ErrCodeInvalidSignature,
			fmt.Sprintf("signature must be 65 bytes, got %d", len(sig)))
	}

	// Ethereum uses v = 27 or 28; go-ethereum expects v = 0 or 1
	sigCopy := make([]byte, 65)
	copy(sigCopy, sig)
	if sigCopy[64] >= 27 {
		sigCopy[64] -= 27
	}

	pubKey, err := crypto.SigToPub(digest, sigCopy)
	if err != nil {
		return common.Address{}, apperr.Wrap(apperr.ErrCodeInvalidSignature, "SigToPub failed", err)
	}

	return crypto.PubkeyToAddress(*pubKey), nil
}

// VerifySignature verifies that the digest was signed by expectedSigner.
func VerifySignature(domain Domain, data Hasher, sig []byte, expected common.Address) error {
	digest := Digest(domain, data)
	signer, err := RecoverSigner(digest, sig)
	if err != nil {
		return err
	}
	if signer != expected {
		return apperr.New(apperr.ErrCodeInvalidSignature,
			fmt.Sprintf("signer mismatch: got %s, expected %s", signer.Hex(), expected.Hex()))
	}
	return nil
}

// ─────────────────────────────────────────────
//  Wallet helpers
// ─────────────────────────────────────────────

// SignDigest signs a raw digest using a private key.
// Returns 65-byte signature (r, s, v) with v = 27 or 28.
func SignDigest(digest []byte, privKey *ecdsa.PrivateKey) ([]byte, error) {
	sig, err := crypto.Sign(digest, privKey)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "Sign failed", err)
	}
	// Convert v from 0/1 to 27/28 for Ethereum compatibility
	sig[64] += 27
	return sig, nil
}

// HexToPrivateKey converts a hex-encoded private key string to *ecdsa.PrivateKey.
// Accepts keys with or without "0x" prefix.
func HexToPrivateKey(hexKey string) (*ecdsa.PrivateKey, error) {
	hexKey = strings.TrimPrefix(hexKey, "0x")
	key, err := crypto.HexToECDSA(hexKey)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "invalid private key", err)
	}
	return key, nil
}

// AddressFromPrivateKey derives the Ethereum address from a private key.
func AddressFromPrivateKey(privKey *ecdsa.PrivateKey) common.Address {
	return crypto.PubkeyToAddress(privKey.PublicKey)
}
