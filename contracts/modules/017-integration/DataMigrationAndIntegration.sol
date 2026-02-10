// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DataMigrationAndIntegration
 * @dev Module 017: Data migration and integration tools
 */
contract DataMigrationAndIntegration is Ownable {
    struct MigrationTask {
        uint256 taskId;
        string dataType;
        address sourceSystem;
        address destinationSystem;
        uint256 recordCount;
        string status;
        uint256 createdAt;
        uint256 completedAt;
    }

    struct IntegrationMapping {
        uint256 mappingId;
        string sourceField;
        string destinationField;
        string transformationRules;
    }

    uint256 private taskCounter;
    uint256 private mappingCounter;
    mapping(uint256 => MigrationTask) private tasks;
    mapping(uint256 => IntegrationMapping) private mappings;
    mapping(address => uint256[]) private systemTasks;
    mapping(address => bool) private authorizedSystems;

    event MigrationStarted(uint256 indexed taskId, string dataType, uint256 recordCount);
    event MigrationCompleted(uint256 indexed taskId, uint256 timeElapsed);
    event MappingCreated(uint256 indexed mappingId, string source, string destination);
    event IntegrationVerified(uint256 indexed taskId);

    constructor() Ownable(msg.sender) {
        taskCounter = 1;
        mappingCounter = 1;
        authorizedSystems[msg.sender] = true;
    }

    function authorizeSystem(address system) external onlyOwner {
        authorizedSystems[system] = true;
    }

    function createMigrationTask(
        string calldata dataType,
        address destinationSystem,
        uint256 recordCount
    ) external returns (uint256) {
        require(authorizedSystems[msg.sender], "Not authorized");
        
        uint256 taskId = taskCounter++;
        tasks[taskId] = MigrationTask({
            taskId: taskId,
            dataType: dataType,
            sourceSystem: msg.sender,
            destinationSystem: destinationSystem,
            recordCount: recordCount,
            status: "pending",
            createdAt: block.timestamp,
            completedAt: 0
        });

        systemTasks[msg.sender].push(taskId);
        emit MigrationStarted(taskId, dataType, recordCount);
        return taskId;
    }

    function completeMigration(uint256 taskId) external {
        require(tasks[taskId].sourceSystem == msg.sender, "Not task owner");
        
        tasks[taskId].status = "completed";
        tasks[taskId].completedAt = block.timestamp;
        
        uint256 elapsed = block.timestamp - tasks[taskId].createdAt;
        emit MigrationCompleted(taskId, elapsed);
    }

    function createMapping(
        string calldata sourceField,
        string calldata destinationField,
        string calldata transformationRules
    ) external onlyOwner returns (uint256) {
        uint256 mappingId = mappingCounter++;
        mappings[mappingId] = IntegrationMapping({
            mappingId: mappingId,
            sourceField: sourceField,
            destinationField: destinationField,
            transformationRules: transformationRules
        });

        emit MappingCreated(mappingId, sourceField, destinationField);
        return mappingId;
    }

    function verifyIntegration(uint256 taskId) external {
        require(
            keccak256(bytes(tasks[taskId].status)) == keccak256(bytes("completed")),
            "Not completed"
        );
        emit IntegrationVerified(taskId);
    }

    function getMigrationStatus(uint256 taskId)
        external
        view
        returns (string memory status, uint256 progress)
    {
        return (tasks[taskId].status, tasks[taskId].recordCount);
    }

    function getTotalTasks() external view returns (uint256) {
        return taskCounter - 1;
    }
}
