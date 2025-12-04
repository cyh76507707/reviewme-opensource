// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ReviewRoulette
 * @notice 6-hour cooldown reward system for ReviewMe.fun
 * @dev Users can claim 20 RM bonus every 6 hours after writing a review
 */

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IReviewMe {
    function getReviewsByReviewer(address reviewer) external view returns (
        ReviewStruct[] memory,
        uint256[] memory reviewIds
    );
}

// Minimal struct to match ReviewMe contract return type
struct ReviewStruct {
    address reviewer;
    address reviewee;
    string content;
    uint8 emoji;
    uint256 timestamp;
}

contract ReviewRoulette {
    // ============ State Variables ============
    
    IERC20 public immutable rmToken;
    IReviewMe public immutable reviewMe;
    address public immutable admin;
    
    bool public finished;
    
    uint256 public constant COOLDOWN = 6 hours;
    uint256 public constant REWARD = 20 ether; // 20 RM
    
    struct UserState {
        uint64 lastClaimTime;     // Timestamp of last claim
        uint64 lastReviewCount;   // Review count at last claim
        uint32 totalClaims;       // Total number of claims
    }
    
    mapping(address => UserState) public users;
    
    // ============ Events ============
    
    event Claimed(
        address indexed user,
        uint32 totalClaims,
        uint256 reward
    );
    event EventFinished(uint256 remainingTokens);
    
    // ============ Constructor ============
    
    constructor(address _rmToken, address _reviewMe) {
        rmToken = IERC20(_rmToken);
        reviewMe = IReviewMe(_reviewMe);
        admin = msg.sender;
    }
    
    // ============ Main Functions ============
    
    /**
     * @notice Claim roulette reward
     * @dev User must have written a new review since last claim and 6 hours must have passed
     */
    function claim() external {
        require(!finished, "Event finished");
        
        UserState storage user = users[msg.sender];
        
        // Check: 6 hours have passed since last claim
        require(
            block.timestamp >= user.lastClaimTime + COOLDOWN,
            "Wait 6 hours between claims"
        );
        
        // Check: User wrote a new review since last claim
        (, uint256[] memory reviewIds) = reviewMe.getReviewsByReviewer(msg.sender);
        uint64 currentReviewCount = uint64(reviewIds.length);
        require(currentReviewCount > user.lastReviewCount, "Write a new review first");
        
        // Check pool balance
        uint256 poolBalance = rmToken.balanceOf(address(this));
        require(poolBalance >= REWARD, "Pool empty");
        
        // Update state
        user.lastClaimTime = uint64(block.timestamp);
        user.lastReviewCount = currentReviewCount;
        user.totalClaims++;
        
        // Transfer reward
        require(rmToken.transfer(msg.sender, REWARD), "Transfer failed");
        
        emit Claimed(msg.sender, user.totalClaims, REWARD);
    }
    
    /**
     * @notice End the event and refund remaining tokens to admin
     */
    function finish() external {
        require(msg.sender == admin, "Not admin");
        require(!finished, "Already finished");
        
        finished = true;
        
        uint256 remaining = rmToken.balanceOf(address(this));
        if (remaining > 0) {
            require(rmToken.transfer(admin, remaining), "Transfer failed");
        }
        
        emit EventFinished(remaining);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get user's roulette info
     */
    function getUserInfo(address userAddr) external view returns (
        uint32 totalClaims,
        uint64 lastClaimTime,
        bool canClaim,
        uint256 secondsUntilNextClaim,
        string memory status
    ) {
        UserState memory user = users[userAddr];
        
        totalClaims = user.totalClaims;
        lastClaimTime = user.lastClaimTime;
        
        // Calculate time until next claim
        if (block.timestamp < user.lastClaimTime + COOLDOWN) {
            secondsUntilNextClaim = (user.lastClaimTime + COOLDOWN) - block.timestamp;
        } else {
            secondsUntilNextClaim = 0;
        }
        
        // Check if can claim
        if (finished) {
            canClaim = false;
            status = "Event finished";
        } else if (secondsUntilNextClaim > 0) {
            canClaim = false;
            status = "Wait for cooldown";
        } else {
            // Check review count
            (, uint256[] memory reviewIds) = reviewMe.getReviewsByReviewer(userAddr);
            uint64 currentReviewCount = uint64(reviewIds.length);
            
            if (currentReviewCount <= user.lastReviewCount) {
                canClaim = false;
                status = "Write a new review first";
            } else if (rmToken.balanceOf(address(this)) < REWARD) {
                canClaim = false;
                status = "Pool empty";
            } else {
                canClaim = true;
                status = "Ready to claim!";
            }
        }
    }
    
    /**
     * @notice Get remaining pool balance
     */
    function getPoolBalance() external view returns (uint256) {
        return rmToken.balanceOf(address(this));
    }
    
    /**
     * @notice Check if event is still active
     */
    function isActive() external view returns (bool) {
        return !finished && rmToken.balanceOf(address(this)) >= REWARD;
    }
    
    /**
     * @notice Get reward amount
     */
    function getReward() external pure returns (uint256) {
        return REWARD;
    }
    
    /**
     * @notice Get cooldown period
     */
    function getCooldown() external pure returns (uint256) {
        return COOLDOWN;
    }
    
    /**
     * @notice Get timing info for frontend countdown timer
     * @return cooldownSeconds Cooldown period in seconds (21600 = 6 hours)
     * @return isTestMode Always false for production contract
     */
    function getTimingInfo() external pure returns (
        uint256 cooldownSeconds,
        bool isTestMode
    ) {
        cooldownSeconds = COOLDOWN;
        isTestMode = false;
    }
}

