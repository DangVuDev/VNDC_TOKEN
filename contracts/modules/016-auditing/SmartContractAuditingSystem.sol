// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SmartContractAuditingSystem
 * @dev Module 016: Smart contract auditing and verification
 */
contract SmartContractAuditingSystem is Ownable {
    struct Audit {
        uint256 auditId;
        address contractAddress;
        address auditor;
        string status;
        uint256 auditDate;
        uint256 criticalIssues;
        uint256 mediumIssues;
        uint256 lowIssues;
    }

    struct AuditReport {
        uint256 auditId;
        string reportHash;
        string findings;
        uint256 timestamp;
    }

    uint256 private auditCounter;
    mapping(uint256 => Audit) private audits;
    mapping(uint256 => AuditReport) private reports;
    mapping(address => bool) private authorizedAuditors;
    mapping(address => uint256[]) private contractAudits;

    event AuditCreated(uint256 indexed auditId, address indexed contract_, address indexed auditor);
    event AuditReportSubmitted(uint256 indexed auditId, string reportHash);
    event AuditCompleted(uint256 indexed auditId, uint256 criticalIssues);

    constructor() Ownable(msg.sender) {
        auditCounter = 1;
        authorizedAuditors[msg.sender] = true;
    }

    function authorizeAuditor(address auditor) external onlyOwner {
        authorizedAuditors[auditor] = true;
    }

    function createAudit(
        address contractAddress,
        uint256 criticalIssues,
        uint256 mediumIssues,
        uint256 lowIssues
    ) external returns (uint256) {
        require(authorizedAuditors[msg.sender], "Not authorized auditor");
        
        uint256 auditId = auditCounter++;
        audits[auditId] = Audit({
            auditId: auditId,
            contractAddress: contractAddress,
            auditor: msg.sender,
            status: "in_progress",
            auditDate: block.timestamp,
            criticalIssues: criticalIssues,
            mediumIssues: mediumIssues,
            lowIssues: lowIssues
        });

        contractAudits[contractAddress].push(auditId);
        emit AuditCreated(auditId, contractAddress, msg.sender);
        return auditId;
    }

    function submitReport(
        uint256 auditId,
        string calldata reportHash,
        string calldata findings
    ) external {
        require(audits[auditId].auditor == msg.sender, "Not audit owner");
        
        reports[auditId] = AuditReport({
            auditId: auditId,
            reportHash: reportHash,
            findings: findings,
            timestamp: block.timestamp
        });

        audits[auditId].status = "completed";
        emit AuditReportSubmitted(auditId, reportHash);
        emit AuditCompleted(auditId, audits[auditId].criticalIssues);
    }

    function getAuditDetails(uint256 auditId)
        external
        view
        returns (
            address contractAddr,
            address auditor,
            string memory status,
            uint256 criticalIssues,
            uint256 mediumIssues,
            uint256 lowIssues
        )
    {
        Audit memory audit = audits[auditId];
        return (
            audit.contractAddress,
            audit.auditor,
            audit.status,
            audit.criticalIssues,
            audit.mediumIssues,
            audit.lowIssues
        );
    }

    function getTotalAudits() external view returns (uint256) {
        return auditCounter - 1;
    }
}
