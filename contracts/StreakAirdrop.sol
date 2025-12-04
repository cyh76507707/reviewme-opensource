// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title StreakAirdrop
 * @notice 7-day streak reward system for ReviewMe.fun
 * @dev Users claim daily rewards after writing reviews. Streak resets if a day is missed.
 *      After 7 days, the cycle repeats but total streak count continues.
 */

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IReviewMe {
    // Returns reviews WRITTEN by this wallet (not received)
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

contract StreakAirdrop {
    // ============ State Variables ============
    
    IERC20 public immutable rmToken;
    IReviewMe public immutable reviewMe;
    address public immutable admin;
    
    bool public finished;
    
    struct UserState {
        uint64 lastClaimDay;      // Unix day of last claim
        uint64 lastReviewCount;   // Review count at last claim
        uint32 totalStreak;       // Total consecutive days (never resets to 0)
    }
    
    mapping(address => UserState) public users;
    
    // Rewards for day 1-7 in the cycle (18 decimals)
    uint256[7] public rewards = [
        10 ether,   // Day 1: 10 RM
        10 ether,   // Day 2: 10 RM
        10 ether,   // Day 3: 10 RM
        20 ether,   // Day 4: 20 RM
        20 ether,   // Day 5: 20 RM
        20 ether,   // Day 6: 20 RM
        50 ether    // Day 7: 50 RM
    ];
    
    // ============ Events ============
    
    event Claimed(
        address indexed user, 
        uint32 totalStreak, 
        uint8 dayInCycle, 
        uint256 reward
    );
    event EventFinished(uint256 remainingTokens);
    
    // ============ Constructor ============
    
    constructor(address _rmToken, address _reviewMe) {
        rmToken = IERC20(_rmToken);
        reviewMe = IReviewMe(_reviewMe);
        admin = msg.sender;  // Deployer becomes admin
    }
    
    // ============ Main Functions ============
    
    /**
     * @notice Claim daily streak reward
     * @dev User must have written a new review since last claim
     */
    function claim() external {
        require(!finished, "Event finished");
        
        uint64 today = uint64(block.timestamp / 1 days);
        UserState storage user = users[msg.sender];
        
        // Check: User wrote a new review since last claim
        // getReviewsByReviewer returns reviews WRITTEN by user (not received)
        (, uint256[] memory reviewIds) = reviewMe.getReviewsByReviewer(msg.sender);
        uint64 currentReviewCount = uint64(reviewIds.length);
        require(currentReviewCount > user.lastReviewCount, "Write a new review first");
        
        // Check: Haven't claimed today
        require(user.lastClaimDay < today, "Already claimed today");
        
        // Update streak
        if (user.lastClaimDay == today - 1) {
            // Consecutive day - increment streak
            user.totalStreak++;
        } else {
            // Missed a day or first claim - start/reset to 1
            user.totalStreak = 1;
        }
        
        user.lastClaimDay = today;
        user.lastReviewCount = currentReviewCount;
        
        // Calculate reward based on day in 7-day cycle
        uint8 dayInCycle = uint8((user.totalStreak - 1) % 7);  // 0-6
        uint256 reward = rewards[dayInCycle];
        
        // Check pool balance
        uint256 poolBalance = rmToken.balanceOf(address(this));
        require(poolBalance >= reward, "Pool empty");
        
        // Transfer reward
        require(rmToken.transfer(msg.sender, reward), "Transfer failed");
        
        emit Claimed(msg.sender, user.totalStreak, dayInCycle + 1, reward);
    }
    
    /**
     * @notice End the event and refund remaining tokens to admin
     * @dev Can only be called by admin, one-time action
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
     * @notice Get user's current streak info
     */
    function getUserInfo(address userAddr) external view returns (
        uint32 totalStreak,
        uint8 currentDayInCycle,
        uint64 lastClaimDay,
        bool canClaimToday,
        uint256 todayReward,
        string memory status
    ) {
        UserState memory user = users[userAddr];
        uint64 today = uint64(block.timestamp / 1 days);
        
        totalStreak = user.totalStreak;
        
        // Calculate what day in cycle they're on
        if (totalStreak == 0) {
            currentDayInCycle = 0;  // Never claimed
        } else {
            currentDayInCycle = uint8((totalStreak - 1) % 7) + 1;  // 1-7
        }
        
        lastClaimDay = user.lastClaimDay;
        
        // Check if can claim
        if (finished) {
            canClaimToday = false;
            status = "Event finished";
            todayReward = 0;
        } else if (user.lastClaimDay >= today) {
            canClaimToday = false;
            status = "Already claimed today";
            todayReward = 0;
        } else {
            // getReviewsByReviewer returns reviews WRITTEN by user
            (, uint256[] memory reviewIds) = reviewMe.getReviewsByReviewer(userAddr);
            uint64 currentReviewCount = uint64(reviewIds.length);
            if (currentReviewCount <= user.lastReviewCount) {
                canClaimToday = false;
                status = "Write a new review first";
                todayReward = 0;
            } else if (rmToken.balanceOf(address(this)) < rewards[0]) {
                canClaimToday = false;
                status = "Pool empty";
                todayReward = 0;
            } else {
                canClaimToday = true;
                // Calculate next reward
                uint8 nextDayInCycle;
                if (user.lastClaimDay == today - 1) {
                    // Will be consecutive
                    nextDayInCycle = uint8(totalStreak % 7);  // Next day in cycle (0-6)
                } else {
                    // Will reset to day 1
                    nextDayInCycle = 0;
                }
                todayReward = rewards[nextDayInCycle];
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
        return !finished && rmToken.balanceOf(address(this)) >= rewards[0];
    }
    
    /**
     * @notice Get all reward amounts
     */
    function getRewards() external view returns (uint256[7] memory) {
        return rewards;
    }
}

