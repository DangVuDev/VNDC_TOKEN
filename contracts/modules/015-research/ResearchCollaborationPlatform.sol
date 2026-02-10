// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ResearchCollaborationPlatform
 * @dev Module 015: Research collaboration management
 */
contract ResearchCollaborationPlatform is Ownable {
    struct ResearchProject {
        uint256 projectId;
        string title;
        string description;
        address principalInvestigator;
        uint256 startDate;
        uint256 endDate;
        string status;
        uint256 teamSize;
    }

    struct Researcher {
        address researcherAddr;
        string name;
        string[] specializations;
        uint256 projectsCompleted;
        uint256 publishedPapers;
    }

    uint256 private projectCounter;
    mapping(uint256 => ResearchProject) private projects;
    mapping(address => Researcher) private researchers;
    mapping(uint256 => address[]) private projectTeams;
    mapping(address => uint256[]) private researcherProjects;

    event ProjectCreated(uint256 indexed projectId, string title, address pi);
    event TeamMemberAdded(uint256 indexed projectId, address indexed member);
    event ProjectCompleted(uint256 indexed projectId);
    event PaperPublished(address indexed researcher, uint256 indexed projectId);

    constructor() Ownable(msg.sender) {
        projectCounter = 1;
    }

    function createResearchProject(
        string calldata title,
        string calldata description,
        uint256 startDate,
        uint256 endDate,
        uint256 teamSize
    ) external returns (uint256) {
        require(startDate < endDate, "Invalid dates");
        
        uint256 projectId = projectCounter++;
        projects[projectId] = ResearchProject({
            projectId: projectId,
            title: title,
            description: description,
            principalInvestigator: msg.sender,
            startDate: startDate,
            endDate: endDate,
            status: "active",
            teamSize: teamSize
        });

        researcherProjects[msg.sender].push(projectId);
        emit ProjectCreated(projectId, title, msg.sender);
        return projectId;
    }

    function addTeamMember(uint256 projectId, address member) external {
        require(projects[projectId].principalInvestigator == msg.sender, "Not PI");
        projectTeams[projectId].push(member);
        researcherProjects[member].push(projectId);
        emit TeamMemberAdded(projectId, member);
    }

    function completeProject(uint256 projectId) external {
        require(projects[projectId].principalInvestigator == msg.sender, "Not PI");
        projects[projectId].status = "completed";
        emit ProjectCompleted(projectId);
    }

    function publishPaper(uint256 projectId) external {
        require(projectId > 0 && projectId < projectCounter, "Invalid project");
        researchers[msg.sender].publishedPapers++;
        emit PaperPublished(msg.sender, projectId);
    }

    function getTotalProjects() external view returns (uint256) {
        return projectCounter - 1;
    }

    function getResearcherStats(address researcher)
        external
        view
        returns (uint256 projectsCompleted, uint256 papers)
    {
        return (researchers[researcher].projectsCompleted, researchers[researcher].publishedPapers);
    }
}
