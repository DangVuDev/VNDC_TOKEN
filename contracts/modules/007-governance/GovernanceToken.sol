// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";

/**
 * @title GovernanceToken
 * @dev Governance token for student DAO with voting capabilities
 * Extends ERC-20 with voting power and delegation
 */
contract GovernanceToken is ERC20, ERC20Votes, ERC20Permit, Ownable {
    // ============ Constants ============
    uint256 public constant INITIAL_SUPPLY = 1_000_000 * 10 ** 18; // 1M tokens
    uint256 public constant MAX_SUPPLY = 10_000_000 * 10 ** 18; // 10M max

    // ============ Constructor ============
    constructor()
        ERC20("Student DAO Governance Token", "SGOV")
        ERC20Permit("Student DAO Governance Token")
        Ownable(msg.sender)
    {
        // Mint initial supply to owner
        _mint(msg.sender, INITIAL_SUPPLY);
    }

    // ============ Mint Function ============
    /**
     * @dev Mint new governance tokens
     */
    function mint(address to, uint256 amount) public onlyOwner {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
    }

    /**
     * @dev Bulk mint tokens to multiple addresses
     */
    function bulkMint(address[] calldata recipients, uint256[] calldata amounts) external onlyOwner {
        require(recipients.length == amounts.length, "Array length mismatch");

        for (uint256 i = 0; i < recipients.length; i++) {
            mint(recipients[i], amounts[i]);
        }
    }

    // ============ Override Functions ============
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Votes)
    {
        super._update(from, to, value);
    }

    function nonces(address owner)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }
}
