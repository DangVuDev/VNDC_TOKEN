// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol"; // Sử dụng chuẩn của OZ

contract VNDCToken is
    ERC20,
    ERC20Burnable,
    AccessControl,
    Pausable,
    EIP712 
{
    using ECDSA for bytes32;

    // ─────────────────────────────────────────────
    //  Constants
    // ─────────────────────────────────────────────

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18;

    // EIP-712 typehash
    bytes32 private constant TRANSFER_TYPEHASH =
        keccak256("Transfer(address from,address to,uint256 amount,uint256 nonce,uint256 deadline)");

    // ─────────────────────────────────────────────
    //  State Variables
    // ─────────────────────────────────────────────

    mapping(address => uint256) public nonces;
    mapping(address => VestingInfo) public vestingInfo;

    struct VestingInfo {
        uint256 amount;
        uint256 releaseTime;
    }

    // ─────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────

    event BalanceSnapshot(address indexed account, uint256 balance, uint256 timestamp);
    event TokensVested(address indexed holder, uint256 amount, uint256 releaseTime);
    event TokensReleased(address indexed holder, uint256 amount);
    event TransferSignature(address indexed from, address indexed to, uint256 amount, uint256 nonce);

    // ─────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────

    constructor(uint256 initialSupply) 
        ERC20("VNDC Token", "VNDC")
        EIP712("VNDC Token", "1") // Khởi tạo Domain Name và Version
    {
        require(initialSupply <= MAX_SUPPLY, "Exceeds max supply");

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);

        if (initialSupply > 0) {
            _mint(msg.sender, initialSupply);
        }
    }

    // ─────────────────────────────────────────────
    //  EIP-712 Meta-Transaction
    // ─────────────────────────────────────────────

    function transferWithSignature(
        address from,
        address to,
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external returns (bool) {
        // Kiểm tra thời gian
        require(block.timestamp <= deadline, "Signature expired");
        require(nonce == nonces[from], "Invalid nonce");

        // Hash dữ liệu theo chuẩn EIP-712
        bytes32 structHash = keccak256(abi.encode(TRANSFER_TYPEHASH, from, to, amount, nonce, deadline));
        bytes32 digest = _hashTypedDataV4(structHash);
        
        address signer = digest.recover(signature);
        
        require(signer == from, "Invalid signature");
        require(signer != address(0), "Zero address signer");

        // Tăng nonce (unchecked để tiết kiệm gas vì không thể tràn số thực tế)
        unchecked {
            nonces[from]++;
        }

        _transfer(from, to, amount);

        emit TransferSignature(from, to, amount, nonce);
        return true;
    }

    // ─────────────────────────────────────────────
    //  Token Management
    // ─────────────────────────────────────────────

    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
    }

    function pause() public onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() public onlyRole(PAUSER_ROLE) { _unpause(); }

    // ─────────────────────────────────────────────
    //  Vesting Logic
    // ─────────────────────────────────────────────

    function vestTokens(address holder, uint256 amount, uint256 releaseTime) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(holder != address(0), "Invalid address");
        require(releaseTime > block.timestamp, "Release must be in future");
        // Tránh ghi đè vesting cũ đang có hiệu lực
        require(vestingInfo[holder].amount == 0, "Vesting already exists");
        require(balanceOf(holder) >= amount, "Insufficient balance");

        vestingInfo[holder] = VestingInfo({
            amount: amount,
            releaseTime: releaseTime
        });

        emit TokensVested(holder, amount, releaseTime);
    }

    function releaseVested(address holder) external {
        VestingInfo memory vesting = vestingInfo[holder];
        require(vesting.amount > 0, "No vested tokens");
        require(block.timestamp >= vesting.releaseTime, "Tokens still locked");

        delete vestingInfo[holder];
        emit TokensReleased(holder, vesting.amount);
    }

    // ─────────────────────────────────────────────
    //  Overrides
    // ─────────────────────────────────────────────

    function _update(address from, address to, uint256 amount) 
        internal 
        override 
        whenNotPaused 
    {
        // Kiểm tra khóa vesting khi chuyển tiền đi
        if (from != address(0)) {
            VestingInfo memory vesting = vestingInfo[from];
            if (vesting.amount > 0 && block.timestamp < vesting.releaseTime) {
                // Đảm bảo số dư sau khi chuyển không thấp hơn số tiền bị khóa
                require(balanceOf(from) - amount >= vesting.amount, "Vested tokens locked");
            }
        }

        super._update(from, to, amount);

        // Emit sau khi update để lấy balance mới chính xác nhất
        if (from != address(0)) emit BalanceSnapshot(from, balanceOf(from), block.timestamp);
        if (to != address(0)) emit BalanceSnapshot(to, balanceOf(to), block.timestamp);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}