// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AnalyticsAndReportingDashboard
 * @dev Module 018: Analytics and reporting dashboard
 */
contract AnalyticsAndReportingDashboard is Ownable {
    struct SystemMetrics {
        uint256 totalUsers;
        uint256 totalTransactions;
        uint256 totalVolume;
        uint256 timestamp;
    }

    struct UserAnalytics {
        address user;
        uint256 activityScore;
        uint256 engagementLevel;
        uint256 lastActivityTime;
    }

    struct Report {
        uint256 reportId;
        string reportType;
        string dataHash;
        uint256 generatedAt;
    }

    uint256 private reportCounter;
    mapping(uint256 => SystemMetrics) private metrics;
    mapping(address => UserAnalytics) private userAnalytics;
    mapping(uint256 => Report) private reports;
    uint256 private lastMetricsUpdate;

    event MetricsUpdated(uint256 totalUsers, uint256 totalTransactions, uint256 timestamp);
    event UserActivityTracked(address indexed user, uint256 activityScore);
    event ReportGenerated(uint256 indexed reportId, string reportType);

    constructor() Ownable(msg.sender) {
        reportCounter = 1;
    }

    function updateMetrics(
        uint256 totalUsers,
        uint256 totalTransactions,
        uint256 totalVolume
    ) external onlyOwner {
        SystemMetrics memory metric = SystemMetrics({
            totalUsers: totalUsers,
            totalTransactions: totalTransactions,
            totalVolume: totalVolume,
            timestamp: block.timestamp
        });

        metrics[block.timestamp] = metric;
        lastMetricsUpdate = block.timestamp;
        emit MetricsUpdated(totalUsers, totalTransactions, block.timestamp);
    }

    function trackUserActivity(
        address user,
        uint256 activityScore,
        uint256 engagementLevel
    ) external onlyOwner {
        userAnalytics[user] = UserAnalytics({
            user: user,
            activityScore: activityScore,
            engagementLevel: engagementLevel,
            lastActivityTime: block.timestamp
        });

        emit UserActivityTracked(user, activityScore);
    }

    function generateReport(
        string calldata reportType,
        string calldata dataHash
    ) external onlyOwner returns (uint256) {
        uint256 reportId = reportCounter++;
        reports[reportId] = Report({
            reportId: reportId,
            reportType: reportType,
            dataHash: dataHash,
            generatedAt: block.timestamp
        });

        emit ReportGenerated(reportId, reportType);
        return reportId;
    }

    function getSystemMetrics(uint256 timestamp)
        external
        view
        returns (
            uint256 totalUsers,
            uint256 totalTransactions,
            uint256 totalVolume
        )
    {
        SystemMetrics memory metric = metrics[timestamp];
        return (metric.totalUsers, metric.totalTransactions, metric.totalVolume);
    }

    function getUserAnalytics(address user)
        external
        view
        returns (
            uint256 activityScore,
            uint256 engagementLevel,
            uint256 lastActivity
        )
    {
        UserAnalytics memory analytics = userAnalytics[user];
        return (analytics.activityScore, analytics.engagementLevel, analytics.lastActivityTime);
    }

    function getReportDetails(uint256 reportId)
        external
        view
        returns (
            string memory reportType,
            string memory dataHash,
            uint256 generatedAt
        )
    {
        Report memory report = reports[reportId];
        return (report.reportType, report.dataHash, report.generatedAt);
    }

    function getTotalReports() external view returns (uint256) {
        return reportCounter - 1;
    }
}
