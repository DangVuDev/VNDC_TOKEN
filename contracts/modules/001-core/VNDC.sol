// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./IVNDCCore.sol";

/// @title VNDC Token
/// @notice Vietnam Digital Currency - ERC20 token for VNDC ecosystem
/// @dev Implements ERC20 with permit extension (ERC2612) for gas optimization
contract VNDC is
    ERC20,
    ERC20Permit,
    ERC20Burnable,
    Ownable,
    Pausable,
    IVNDCToken,
    IVNDCEvents
{
    // Minting and burning rights
    mapping(address => bool) private _minters;
    mapping(address => bool) private _burners;

    // Events
    event MinterAdded(address indexed account);
    event MinterRemoved(address indexed account);
    event BurnerAdded(address indexed account);
    event BurnerRemoved(address indexed account);

    /// @notice Initialize VNDC Token
    /// @param initialSupply Initial token supply (in wei, 18 decimals)
    constructor(
        uint256 initialSupply
    )
        ERC20("Vietnam Digital Currency", "VNDC")
        ERC20Permit("Vietnam Digital Currency")
        Ownable(msg.sender)
    {
        // Give owner minting rights and burner rights
        _minters[msg.sender] = true;
        _burners[msg.sender] = true;

        // Mint initial supply to owner
        if (initialSupply > 0) {
            _mint(msg.sender, initialSupply);
            emit TokenMinted(msg.sender, initialSupply);
        }
    }

    // ================== Minting & Burning ==================

    /// @notice Mint new tokens
    /// @param to Recipient address
    /// @param amount Amount to mint
    function mint(address to, uint256 amount) external {
        require(_minters[msg.sender], "VNDC: Caller is not a minter");
        require(to != address(0), "VNDC: Cannot mint to zero address");
        require(amount > 0, "VNDC: Amount must be greater than 0");

        _mint(to, amount);
        emit TokenMinted(to, amount);
    }

    /// @notice Burn tokens from caller
    /// @param amount Amount to burn
    function burn(uint256 amount) public override(ERC20Burnable) {
        require(amount > 0, "VNDC: Amount must be greater than 0");
        _burn(msg.sender, amount);
        emit TokenBurned(msg.sender, amount);
    }

    /// @notice Burn tokens from another address (if authorized)
    /// @param from Account to burn from
    /// @param amount Amount to burn
    function burnFrom(address from, uint256 amount)
        public
        override(ERC20Burnable, IVNDCToken)
    {
        require(_burners[msg.sender], "VNDC: Caller is not a burner");
        uint256 currentAllowance = allowance(from, msg.sender);
        require(
            currentAllowance >= amount,
            "ERC20: insufficient allowance"
        );
        unchecked {
            _approve(from, msg.sender, currentAllowance - amount);
        }
        _burn(from, amount);
        emit TokenBurned(from, amount);
    }

    // ================== Minter Management ==================

    /// @notice Add minter role
    /// @param account Address to add minting rights
    function addMinter(address account) external onlyOwner {
        require(account != address(0), "VNDC: Invalid address");
        _minters[account] = true;
        emit MinterAdded(account);
    }

    /// @notice Remove minter role
    /// @param account Address to remove minting rights
    function removeMinter(address account) external onlyOwner {
        _minters[account] = false;
        emit MinterRemoved(account);
    }

    /// @notice Check if address is minter
    /// @param account Address to check
    /// @return True if address has minting rights
    function isMinter(address account) external view returns (bool) {
        return _minters[account];
    }

    // ================== Burner Management ==================

    /// @notice Add burner role
    /// @param account Address to add burning rights
    function addBurner(address account) external onlyOwner {
        require(account != address(0), "VNDC: Invalid address");
        _burners[account] = true;
        emit BurnerAdded(account);
    }

    /// @notice Remove burner role
    /// @param account Address to remove burning rights
    function removeBurner(address account) external onlyOwner {
        _burners[account] = false;
        emit BurnerRemoved(account);
    }

    /// @notice Check if address is burner
    /// @param account Address to check
    /// @return True if address has burning rights
    function isBurner(address account) external view returns (bool) {
        return _burners[account];
    }

    // ================== Pausable Functions ==================

    /// @notice Pause all transfers
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause all transfers
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Check if contract is paused
    /// @return True if paused
    function isPaused() external view returns (bool) {
        return paused();
    }

    // ================== Override Transfer Functions ==================

    /// @notice Override transfer to check pause status
    function transfer(address to, uint256 amount)
        public
        override(ERC20)
        whenNotPaused
        returns (bool)
    {
        return super.transfer(to, amount);
    }

    /// @notice Override transferFrom to check pause status
    function transferFrom(
        address from,
        address to,
        uint256 amount
    )
        public
        override(ERC20)
        whenNotPaused
        returns (bool)
    {
        return super.transferFrom(from, to, amount);
    }

    /// @notice Override _update to apply pause check
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        super._update(from, to, amount);
    }

    // ================== Metadata ==================

    /// @notice Get decimals
    /// @return Decimal places (18)
    function decimals() public view override(ERC20) returns (uint8) {
        return 18;
    }

    /// @notice Get token name
    /// @return Token name
    function name() public view override(ERC20) returns (string memory) {
        return super.name();
    }

    /// @notice Get token symbol
    /// @return Token symbol
    function symbol() public view override(ERC20) returns (string memory) {
        return super.symbol();
    }

    // ================== Permit (ERC2612) ==================

    /// @notice Permit function for gas-free approvals
    /// @param owner Token owner
    /// @param spender Spender address
    /// @param amount Amount to approve
    /// @param deadline Deadline for permit (unix timestamp)
    /// @param v Signature v
    /// @param r Signature r
    /// @param s Signature s
    function permit(
        address owner,
        address spender,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public override(ERC20Permit, IVNDCToken) {
        super.permit(owner, spender, amount, deadline, v, r, s);
    }

    // ================== Utility ==================

    /// @notice Get token info
    /// @return name Token name
    /// @return symbol Token symbol
    /// @return decimals Token decimals
    /// @return totalSupply Total token supply
    function getTokenInfo()
        external
        view
        returns (
            string memory,
            string memory,
            uint8,
            uint256
        )
    {
        return (name(), symbol(), decimals(), totalSupply());
    }
}
