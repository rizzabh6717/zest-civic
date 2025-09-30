// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title ZentSimple
 * @dev Simplified Zentigrity contract implementing the 5 core transaction types
 */
contract ZentSimple is AccessControl, ReentrancyGuard {
    using Counters for Counters.Counter;

    // Roles
    bytes32 public constant DAO_ROLE = keccak256("DAO_ROLE");
    bytes32 public constant WORKER_ROLE = keccak256("WORKER_ROLE");

    // Counters
    Counters.Counter private _grievanceIds;
    Counters.Counter private _bidIds;

    // Enums
    enum GrievanceStatus {
        Open,
        Assigned,
        Completed,
        Resolved
    }

    // Structs
    struct Grievance {
        uint256 id;
        address citizen;
        string dataHash; // Hash of database record for verification
        uint256 timestamp;
        GrievanceStatus status;
        address assignedWorker;
        uint256 escrowAmount;
        bool isActive;
    }

    struct WorkerBid {
        uint256 id;
        uint256 grievanceId;
        address worker;
        uint256 bidAmountAVAX; // AVAX equivalent of INR bid
        uint256 bidAmountINR;  // Original INR amount
        uint256 timestamp;
        bool isActive;
    }

    struct TaskCompletion {
        uint256 grievanceId;
        address worker;
        string proofHash; // Hash of completion proof in database
        uint256 timestamp;
        bool citizenConfirmed;
        bool daoConfirmed;
    }

    // Storage
    mapping(uint256 => Grievance) public grievances;
    mapping(uint256 => WorkerBid) public workerBids;
    mapping(uint256 => uint256[]) public grievanceBids; // grievanceId => bidIds[]
    mapping(uint256 => TaskCompletion) public taskCompletions;
    mapping(uint256 => uint256) public escrowBalances; // grievanceId => locked AVAX

    // Platform settings
    uint256 public platformFeePercentage = 250; // 2.5% (basis points)
    address public feeCollector;
    
    // INR to AVAX conversion (updated by oracle/DAO)
    uint256 public avaxPriceINR = 250000; // 1 AVAX = 2500 INR (with 2 decimals: 250000)
    uint256 public constant PRICE_DECIMALS = 100; // For 2 decimal places

    // Events
    event GrievanceSubmitted(
        uint256 indexed grievanceId,
        address indexed citizen,
        string dataHash,
        uint256 timestamp
    );

    event BidSubmitted(
        uint256 indexed bidId,
        uint256 indexed grievanceId,
        address indexed worker,
        uint256 bidAmountAVAX,
        uint256 bidAmountINR,
        uint256 timestamp
    );

    event TaskAssigned(
        uint256 indexed grievanceId,
        address indexed worker,
        uint256 escrowAmount
    );

    event TaskCompleted(
        uint256 indexed grievanceId,
        address indexed worker,
        string proofHash,
        uint256 timestamp
    );

    event FundsReleased(
        uint256 indexed grievanceId,
        address indexed worker,
        uint256 amount,
        uint256 platformFee
    );

    event AVAXPriceUpdated(
        uint256 oldPrice,
        uint256 newPrice
    );

    modifier grievanceExists(uint256 _grievanceId) {
        require(_grievanceId > 0 && _grievanceId <= _grievanceIds.current(), "Grievance does not exist");
        _;
    }

    modifier onlyGrievanceCitizen(uint256 _grievanceId) {
        require(grievances[_grievanceId].citizen == msg.sender, "Only grievance citizen can call this");
        _;
    }

    constructor(address _feeCollector) {
        require(_feeCollector != address(0), "Invalid fee collector address");
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(DAO_ROLE, msg.sender);
        feeCollector = _feeCollector;
    }

    // ===============================
    // 1. GRIEVANCE REGISTRY (Submit Grievance)
    // ===============================
    
    /**
     * @dev Submit a new grievance
     * @param _dataHash Hash of grievance data stored in database
     */
    function submitGrievance(string memory _dataHash) 
        external 
        nonReentrant 
        returns (uint256) 
    {
        require(bytes(_dataHash).length > 0, "Data hash required");

        _grievanceIds.increment();
        uint256 newGrievanceId = _grievanceIds.current();

        Grievance storage newGrievance = grievances[newGrievanceId];
        newGrievance.id = newGrievanceId;
        newGrievance.citizen = msg.sender;
        newGrievance.dataHash = _dataHash;
        newGrievance.timestamp = block.timestamp;
        newGrievance.status = GrievanceStatus.Open;
        newGrievance.isActive = true;

        emit GrievanceSubmitted(newGrievanceId, msg.sender, _dataHash, block.timestamp);
        
        return newGrievanceId;
    }

    // ===============================
    // 2. SUBMIT BID (Worker Bid Submission)
    // ===============================
    
    /**
     * @dev Submit bid for a grievance
     * @param _grievanceId Target grievance ID
     * @param _bidAmountINR Bid amount in INR (with 2 decimals: 120.50 INR = 12050)
     */
    function submitBid(
        uint256 _grievanceId,
        uint256 _bidAmountINR
    ) 
        external 
        grievanceExists(_grievanceId)
        onlyRole(WORKER_ROLE)
        nonReentrant 
        returns (uint256) 
    {
        require(grievances[_grievanceId].status == GrievanceStatus.Open, "Grievance not open for bidding");
        require(_bidAmountINR > 0, "Bid amount must be greater than 0");

        // Convert INR to AVAX
        uint256 bidAmountAVAX = (_bidAmountINR * 10**18) / avaxPriceINR * PRICE_DECIMALS;

        _bidIds.increment();
        uint256 newBidId = _bidIds.current();

        WorkerBid storage newBid = workerBids[newBidId];
        newBid.id = newBidId;
        newBid.grievanceId = _grievanceId;
        newBid.worker = msg.sender;
        newBid.bidAmountAVAX = bidAmountAVAX;
        newBid.bidAmountINR = _bidAmountINR;
        newBid.timestamp = block.timestamp;
        newBid.isActive = true;

        // Add to grievance bids list
        grievanceBids[_grievanceId].push(newBidId);

        emit BidSubmitted(newBidId, _grievanceId, msg.sender, bidAmountAVAX, _bidAmountINR, block.timestamp);
        
        return newBidId;
    }

    // ===============================
    // 3. TASK ASSIGNMENT (DAO Assigns Task)
    // ===============================
    
    /**
     * @dev Assign task to winning bidder and lock escrow
     * @param _grievanceId Target grievance ID
     * @param _winningBidId Selected bid ID
     */
    function assignTask(
        uint256 _grievanceId,
        uint256 _winningBidId
    ) 
        external 
        payable
        grievanceExists(_grievanceId)
        onlyRole(DAO_ROLE)
        nonReentrant 
    {
        require(grievances[_grievanceId].status == GrievanceStatus.Open, "Grievance not open");
        
        WorkerBid storage winningBid = workerBids[_winningBidId];
        require(winningBid.grievanceId == _grievanceId, "Bid not for this grievance");
        require(winningBid.isActive, "Bid not active");
        require(msg.value == winningBid.bidAmountAVAX, "Incorrect escrow amount");

        // Update grievance
        Grievance storage grievance = grievances[_grievanceId];
        grievance.status = GrievanceStatus.Assigned;
        grievance.assignedWorker = winningBid.worker;
        grievance.escrowAmount = winningBid.bidAmountAVAX;

        // Lock escrow funds
        escrowBalances[_grievanceId] = msg.value;

        emit TaskAssigned(_grievanceId, winningBid.worker, msg.value);
    }

    // ===============================
    // 4. WORK COMPLETE (Task Resolution Proof)
    // ===============================
    
    /**
     * @dev Submit task completion proof
     * @param _grievanceId Target grievance ID
     * @param _proofHash Hash of completion proof stored in database
     */
    function submitWorkComplete(
        uint256 _grievanceId,
        string memory _proofHash
    ) 
        external 
        grievanceExists(_grievanceId)
        nonReentrant 
    {
        Grievance storage grievance = grievances[_grievanceId];
        require(grievance.status == GrievanceStatus.Assigned, "Task not assigned");
        require(grievance.assignedWorker == msg.sender, "Only assigned worker can submit");
        require(bytes(_proofHash).length > 0, "Proof hash required");

        // Update grievance status
        grievance.status = GrievanceStatus.Completed;

        // Store completion details
        TaskCompletion storage completion = taskCompletions[_grievanceId];
        completion.grievanceId = _grievanceId;
        completion.worker = msg.sender;
        completion.proofHash = _proofHash;
        completion.timestamp = block.timestamp;

        emit TaskCompleted(_grievanceId, msg.sender, _proofHash, block.timestamp);
    }

    // ===============================
    // 5. ESCROW MANAGER (Funds Release)
    // ===============================
    
    /**
     * @dev Citizen confirms task completion
     * @param _grievanceId Target grievance ID
     */
    function citizenConfirmCompletion(uint256 _grievanceId) 
        external 
        grievanceExists(_grievanceId)
        onlyGrievanceCitizen(_grievanceId)
    {
        require(grievances[_grievanceId].status == GrievanceStatus.Completed, "Task not completed");
        
        TaskCompletion storage completion = taskCompletions[_grievanceId];
        completion.citizenConfirmed = true;

        // Auto-release if both confirmations received
        if (completion.daoConfirmed) {
            _releaseFunds(_grievanceId);
        }
    }

    /**
     * @dev DAO confirms task completion
     * @param _grievanceId Target grievance ID
     */
    function daoConfirmCompletion(uint256 _grievanceId) 
        external 
        grievanceExists(_grievanceId)
        onlyRole(DAO_ROLE)
    {
        require(grievances[_grievanceId].status == GrievanceStatus.Completed, "Task not completed");
        
        TaskCompletion storage completion = taskCompletions[_grievanceId];
        completion.daoConfirmed = true;

        // Auto-release if both confirmations received
        if (completion.citizenConfirmed) {
            _releaseFunds(_grievanceId);
        }
    }

    /**
     * @dev Internal function to release escrowed funds
     * @param _grievanceId Target grievance ID
     */
    function _releaseFunds(uint256 _grievanceId) internal {
        Grievance storage grievance = grievances[_grievanceId];
        uint256 escrowAmount = escrowBalances[_grievanceId];
        
        require(escrowAmount > 0, "No escrow to release");

        // Calculate platform fee and worker payment
        uint256 platformFee = (escrowAmount * platformFeePercentage) / 10000;
        uint256 workerPayment = escrowAmount - platformFee;

        // Update state
        grievance.status = GrievanceStatus.Resolved;
        escrowBalances[_grievanceId] = 0;

        // Transfer payments
        (bool workerSuccess, ) = grievance.assignedWorker.call{value: workerPayment}("");
        require(workerSuccess, "Worker payment failed");

        if (platformFee > 0) {
            (bool feeSuccess, ) = feeCollector.call{value: platformFee}("");
            require(feeSuccess, "Fee transfer failed");
        }

        emit FundsReleased(_grievanceId, grievance.assignedWorker, workerPayment, platformFee);
    }

    // ===============================
    // VIEW FUNCTIONS
    // ===============================
    
    /**
     * @dev Get grievance details
     */
    function getGrievance(uint256 _grievanceId) 
        external 
        view 
        grievanceExists(_grievanceId) 
        returns (Grievance memory) 
    {
        return grievances[_grievanceId];
    }

    /**
     * @dev Get bids for a grievance
     */
    function getGrievanceBids(uint256 _grievanceId) 
        external 
        view 
        grievanceExists(_grievanceId) 
        returns (uint256[] memory) 
    {
        return grievanceBids[_grievanceId];
    }

    /**
     * @dev Get bid details
     */
    function getBid(uint256 _bidId) external view returns (WorkerBid memory) {
        return workerBids[_bidId];
    }

    /**
     * @dev Get task completion details
     */
    function getTaskCompletion(uint256 _grievanceId) 
        external 
        view 
        grievanceExists(_grievanceId) 
        returns (TaskCompletion memory) 
    {
        return taskCompletions[_grievanceId];
    }

    /**
     * @dev Convert INR to AVAX
     */
    function convertINRToAVAX(uint256 _amountINR) external view returns (uint256) {
        return (_amountINR * 10**18) / avaxPriceINR * PRICE_DECIMALS;
    }

    /**
     * @dev Convert AVAX to INR
     */
    function convertAVAXToINR(uint256 _amountAVAX) external view returns (uint256) {
        return (_amountAVAX * avaxPriceINR) / (10**18 * PRICE_DECIMALS);
    }

    /**
     * @dev Get all open grievances (for DAO dashboard)
     */
    function getOpenGrievances() external view returns (uint256[] memory) {
        uint256 totalGrievances = _grievanceIds.current();
        uint256[] memory openGrievances = new uint256[](totalGrievances);
        uint256 openCount = 0;

        for (uint256 i = 1; i <= totalGrievances; i++) {
            if (grievances[i].isActive && grievances[i].status != GrievanceStatus.Resolved) {
                openGrievances[openCount] = i;
                openCount++;
            }
        }

        // Resize array
        assembly {
            mstore(openGrievances, openCount)
        }

        return openGrievances;
    }

    // ===============================
    // ADMIN FUNCTIONS
    // ===============================
    
    /**
     * @dev Update AVAX price in INR (DAO only)
     * @param _newPriceINR New price (1 AVAX = X INR, with 2 decimals)
     */
    function updateAVAXPrice(uint256 _newPriceINR) external onlyRole(DAO_ROLE) {
        require(_newPriceINR > 0, "Price must be greater than 0");
        
        uint256 oldPrice = avaxPriceINR;
        avaxPriceINR = _newPriceINR;

        emit AVAXPriceUpdated(oldPrice, _newPriceINR);
    }

    /**
     * @dev Update platform fee percentage
     */
    function setPlatformFee(uint256 _feePercentage) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_feePercentage <= 1000, "Fee cannot exceed 10%"); // Max 10%
        platformFeePercentage = _feePercentage;
    }

    /**
     * @dev Grant worker role
     */
    function grantWorkerRole(address _worker) external onlyRole(DAO_ROLE) {
        _grantRole(WORKER_ROLE, _worker);
    }

    /**
     * @dev Grant DAO role
     */
    function grantDAORole(address _dao) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(DAO_ROLE, _dao);
    }

    /**
     * @dev Get total counts for dashboard
     */
    function getDashboardStats() external view returns (
        uint256 totalGrievances,
        uint256 totalBids,
        uint256 openGrievances,
        uint256 assignedTasks,
        uint256 completedTasks,
        uint256 resolvedGrievances
    ) {
        totalGrievances = _grievanceIds.current();
        totalBids = _bidIds.current();

        // Count by status
        for (uint256 i = 1; i <= totalGrievances; i++) {
            if (grievances[i].isActive) {
                if (grievances[i].status == GrievanceStatus.Open) {
                    openGrievances++;
                } else if (grievances[i].status == GrievanceStatus.Assigned) {
                    assignedTasks++;
                } else if (grievances[i].status == GrievanceStatus.Completed) {
                    completedTasks++;
                } else if (grievances[i].status == GrievanceStatus.Resolved) {
                    resolvedGrievances++;
                }
            }
        }
    }

    // Emergency functions
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        // Implementation for emergency pause
    }

    function emergencyWithdraw() external onlyRole(DEFAULT_ADMIN_ROLE) {
        // Implementation for emergency withdrawal
    }
}