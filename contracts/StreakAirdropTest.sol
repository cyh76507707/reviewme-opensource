// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title StreakAirdropTest
 * @notice TEST VERSION - 7-day streak reward system with 1-minute "days"
 * @dev Same as StreakAirdrop but with configurable day length for testing.
 *      DO NOT USE IN PRODUCTION - Use StreakAirdrop.sol instead.
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

struct ReviewStruct {
    address reviewer;
    address reviewee;
    string content;
    uint8 emoji;
    uint256 timestamp;
}

contract StreakAirdropTest {
    // ============ State Variables ============
    
    IERC20 public immutable rmToken;
    IReviewMe public immutable reviewMe;
    address public immutable admin;
    
    // Day length in seconds (60 = 1 minute for testing, 86400 = 24 hours for production)
    uint256 public immutable dayLength;
    
    bool public finished;
    
    struct UserState {
        uint64 lastClaimDay;      // "Day" number of last claim
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
    
    /**
     * @param _rmToken RM token address
     * @param _reviewMe ReviewMe contract address
     * @param _dayLength Length of a "day" in seconds (60 for testing, 86400 for production)
     */
    constructor(address _rmToken, address _reviewMe, uint256 _dayLength) {
        rmToken = IERC20(_rmToken);
        reviewMe = IReviewMe(_reviewMe);
        admin = msg.sender;
        dayLength = _dayLength;
    }
    
    // ============ Helper Functions ============
    
    function _getCurrentDay() internal view returns (uint64) {
        return uint64(block.timestamp / dayLength);
    }
    
    // ============ Main Functions ============
    
    function claim() external {
        require(!finished, "Event finished");
        
        uint64 today = _getCurrentDay();
        UserState storage user = users[msg.sender];
        
        // Check: User wrote a new review since last claim
        (, uint256[] memory reviewIds) = reviewMe.getReviewsByReviewer(msg.sender);
        uint64 currentReviewCount = uint64(reviewIds.length);
        require(currentReviewCount > user.lastReviewCount, "Write a new review first");
        
        // Check: Haven't claimed today
        require(user.lastClaimDay < today, "Already claimed today");
        
        // Update streak
        if (user.lastClaimDay == today - 1) {
            user.totalStreak++;
        } else {
            user.totalStreak = 1;
        }
        
        user.lastClaimDay = today;
        user.lastReviewCount = currentReviewCount;
        
        // Calculate reward based on day in 7-day cycle
        uint8 dayInCycle = uint8((user.totalStreak - 1) % 7);
        uint256 reward = rewards[dayInCycle];
        
        // Check pool balance
        uint256 poolBalance = rmToken.balanceOf(address(this));
        require(poolBalance >= reward, "Pool empty");
        
        // Transfer reward
        require(rmToken.transfer(msg.sender, reward), "Transfer failed");
        
        emit Claimed(msg.sender, user.totalStreak, dayInCycle + 1, reward);
    }
    
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
     * @notice Get user's current streak info with timing data
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
        uint64 today = _getCurrentDay();
        
        totalStreak = user.totalStreak;
        
        if (totalStreak == 0) {
            currentDayInCycle = 0;
        } else {
            currentDayInCycle = uint8((totalStreak - 1) % 7) + 1;
        }
        
        lastClaimDay = user.lastClaimDay;
        
        if (finished) {
            canClaimToday = false;
            status = "Event finished";
            todayReward = 0;
        } else if (user.lastClaimDay >= today) {
            canClaimToday = false;
            status = "Already claimed today";
            todayReward = 0;
        } else {
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
                uint8 nextDayInCycle;
                if (user.lastClaimDay == today - 1) {
                    nextDayInCycle = uint8(totalStreak % 7);
                } else {
                    nextDayInCycle = 0;
                }
                todayReward = rewards[nextDayInCycle];
                status = "Ready to claim!";
            }
        }
    }
    
    /**
     * @notice Get timing info for countdown timer
     * @return currentDay Current "day" number
     * @return secondsUntilNextDay Seconds until next "day" starts
     * @return dayLengthSeconds Length of a "day" in seconds
     */
    function getTimingInfo() external view returns (
        uint64 currentDay,
        uint256 secondsUntilNextDay,
        uint256 dayLengthSeconds
    ) {
        currentDay = _getCurrentDay();
        uint256 nextDayStart = (uint256(currentDay) + 1) * dayLength;
        secondsUntilNextDay = nextDayStart - block.timestamp;
        dayLengthSeconds = dayLength;
    }
    
    /**
     * @notice Get user's last claim timestamp for countdown calculation
     */
    function getUserLastClaimDay(address userAddr) external view returns (uint64) {
        return users[userAddr].lastClaimDay;
    }
    
    function getPoolBalance() external view returns (uint256) {
        return rmToken.balanceOf(address(this));
    }
    
    function isActive() external view returns (bool) {
        return !finished && rmToken.balanceOf(address(this)) >= rewards[0];
    }
    
    function getRewards() external view returns (uint256[7] memory) {
        return rewards;
    }
    
    function getDayLength() external view returns (uint256) {
        return dayLength;
    }
}

