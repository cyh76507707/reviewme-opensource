// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/StreakAirdrop.sol";

// Mock ERC20 token for testing
contract MockERC20 is IERC20 {
    string public name = "ReviewMe Token";
    string public symbol = "RM";
    uint8 public decimals = 18;
    uint256 public totalSupply;
    
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }
    
    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
    
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

// Mock ReviewMe contract for testing
contract MockReviewMe is IReviewMe {
    mapping(address => uint256) public reviewCounts;
    
    function setReviewCount(address user, uint256 count) external {
        reviewCounts[user] = count;
    }
    
    function incrementReviewCount(address user) external {
        reviewCounts[user]++;
    }
    
    // New interface: returns reviews WRITTEN by user
    function getReviewsByReviewer(address reviewer) external view returns (
        ReviewStruct[] memory,
        uint256[] memory reviewIds
    ) {
        uint256 count = reviewCounts[reviewer];
        ReviewStruct[] memory reviews = new ReviewStruct[](count);
        uint256[] memory ids = new uint256[](count);
        
        // Just return empty structs with correct length
        for (uint256 i = 0; i < count; i++) {
            reviews[i] = ReviewStruct({
                reviewer: reviewer,
                reviewee: address(0),
                content: "",
                emoji: 1,
                timestamp: block.timestamp
            });
            ids[i] = i + 1;
        }
        
        return (reviews, ids);
    }
}

contract StreakAirdropTest is Test {
    StreakAirdrop public airdrop;
    MockERC20 public rmToken;
    MockReviewMe public reviewMe;
    
    address public admin = address(1);
    address public user1 = address(2);
    address public user2 = address(3);
    
    uint256 constant POOL_AMOUNT = 10000 ether;  // 10,000 RM
    
    function setUp() public {
        // Warp to a reasonable timestamp (Nov 27, 2025)
        vm.warp(1732723200);
        
        vm.startPrank(admin);
        
        // Deploy mock contracts
        rmToken = new MockERC20();
        reviewMe = new MockReviewMe();
        
        // Deploy airdrop contract
        airdrop = new StreakAirdrop(address(rmToken), address(reviewMe));
        
        // Fund the airdrop pool
        rmToken.mint(address(airdrop), POOL_AMOUNT);
        
        vm.stopPrank();
    }
    
    // ============ Basic Tests ============
    
    function test_Deployment() public view {
        assertEq(airdrop.admin(), admin);
        assertEq(address(airdrop.rmToken()), address(rmToken));
        assertEq(address(airdrop.reviewMe()), address(reviewMe));
        assertEq(airdrop.getPoolBalance(), POOL_AMOUNT);
        assertEq(airdrop.finished(), false);
    }
    
    function test_CannotClaimWithoutReview() public {
        vm.prank(user1);
        vm.expectRevert("Write a new review first");
        airdrop.claim();
    }
    
    function test_FirstClaim() public {
        // User writes a review
        reviewMe.setReviewCount(user1, 1);
        
        // User claims
        vm.prank(user1);
        airdrop.claim();
        
        // Check user received Day 1 reward (10 RM)
        assertEq(rmToken.balanceOf(user1), 10 ether);
        
        // Check user state
        (uint32 totalStreak, uint8 dayInCycle, , , , ) = airdrop.getUserInfo(user1);
        assertEq(totalStreak, 1);
        assertEq(dayInCycle, 1);
    }
    
    function test_CannotClaimTwiceSameDay() public {
        reviewMe.setReviewCount(user1, 1);
        
        vm.startPrank(user1);
        airdrop.claim();
        
        // Write another review, then try to claim again same day
        reviewMe.setReviewCount(user1, 2);
        
        vm.expectRevert("Already claimed today");
        airdrop.claim();
        vm.stopPrank();
    }
    
    function test_CannotClaimWithoutNewReview() public {
        // First claim
        reviewMe.setReviewCount(user1, 1);
        vm.prank(user1);
        airdrop.claim();
        
        // Next day, try to claim without new review
        vm.warp(block.timestamp + 1 days);
        
        vm.prank(user1);
        vm.expectRevert("Write a new review first");
        airdrop.claim();
    }
    
    // ============ Streak Tests ============
    
    function test_ConsecutiveDayStreak() public {
        // Day 1
        reviewMe.setReviewCount(user1, 1);
        vm.prank(user1);
        airdrop.claim();
        assertEq(rmToken.balanceOf(user1), 10 ether);  // Day 1: 10 RM
        
        // Day 2
        vm.warp(block.timestamp + 1 days);
        reviewMe.setReviewCount(user1, 2);
        vm.prank(user1);
        airdrop.claim();
        assertEq(rmToken.balanceOf(user1), 20 ether);  // Day 1 + Day 2: 10 + 10
        
        // Day 3
        vm.warp(block.timestamp + 1 days);
        reviewMe.setReviewCount(user1, 3);
        vm.prank(user1);
        airdrop.claim();
        assertEq(rmToken.balanceOf(user1), 30 ether);  // + Day 3: 10
        
        // Check streak
        (uint32 totalStreak, uint8 dayInCycle, , , , ) = airdrop.getUserInfo(user1);
        assertEq(totalStreak, 3);
        assertEq(dayInCycle, 3);
    }
    
    function test_StreakResetAfterMissedDay() public {
        // Day 1
        reviewMe.setReviewCount(user1, 1);
        vm.prank(user1);
        airdrop.claim();
        
        // Skip a day (miss Day 2)
        vm.warp(block.timestamp + 2 days);
        
        // Day 3 - streak should reset
        reviewMe.setReviewCount(user1, 2);
        vm.prank(user1);
        airdrop.claim();
        
        (uint32 totalStreak, uint8 dayInCycle, , , , ) = airdrop.getUserInfo(user1);
        assertEq(totalStreak, 1);  // Reset to 1
        assertEq(dayInCycle, 1);   // Back to Day 1 in cycle
    }
    
    function test_Full7DayCycle() public {
        uint256 expectedTotal = 0;
        uint256[7] memory expectedRewards = [uint256(10 ether), 10 ether, 10 ether, 20 ether, 20 ether, 20 ether, 50 ether];
        
        for (uint256 i = 0; i < 7; i++) {
            if (i > 0) {
                vm.warp(block.timestamp + 1 days);
            }
            reviewMe.setReviewCount(user1, i + 1);
            vm.prank(user1);
            airdrop.claim();
            
            expectedTotal += expectedRewards[i];
            assertEq(rmToken.balanceOf(user1), expectedTotal);
        }
        
        // Total after 7 days: 10+10+10+20+20+20+50 = 140 RM
        assertEq(rmToken.balanceOf(user1), 140 ether);
        
        (uint32 totalStreak, uint8 dayInCycle, , , , ) = airdrop.getUserInfo(user1);
        assertEq(totalStreak, 7);
        assertEq(dayInCycle, 7);
    }
    
    function test_CycleRestartsAfterDay7() public {
        // Complete 7-day cycle
        for (uint256 i = 0; i < 7; i++) {
            if (i > 0) vm.warp(block.timestamp + 1 days);
            reviewMe.setReviewCount(user1, i + 1);
            vm.prank(user1);
            airdrop.claim();
        }
        
        // Day 8 - should restart at Day 1 reward but totalStreak = 8
        vm.warp(block.timestamp + 1 days);
        reviewMe.setReviewCount(user1, 8);
        
        uint256 balanceBefore = rmToken.balanceOf(user1);
        vm.prank(user1);
        airdrop.claim();
        
        // Should receive Day 1 reward (10 RM)
        assertEq(rmToken.balanceOf(user1) - balanceBefore, 10 ether);
        
        (uint32 totalStreak, uint8 dayInCycle, , , , ) = airdrop.getUserInfo(user1);
        assertEq(totalStreak, 8);    // Total continues
        assertEq(dayInCycle, 1);     // Cycle restarts at 1
    }
    
    function test_LongStreak() public {
        // Test 15 days of consecutive claiming
        for (uint256 i = 0; i < 15; i++) {
            if (i > 0) vm.warp(block.timestamp + 1 days);
            reviewMe.setReviewCount(user1, i + 1);
            vm.prank(user1);
            airdrop.claim();
        }
        
        (uint32 totalStreak, uint8 dayInCycle, , , , ) = airdrop.getUserInfo(user1);
        assertEq(totalStreak, 15);
        assertEq(dayInCycle, 1);  // 15 % 7 = 1 (Day 1 in cycle)
    }
    
    // ============ Admin Tests ============
    
    function test_OnlyAdminCanFinish() public {
        vm.prank(user1);
        vm.expectRevert("Not admin");
        airdrop.finish();
    }
    
    function test_FinishRefundsToAdmin() public {
        uint256 adminBalanceBefore = rmToken.balanceOf(admin);
        
        vm.prank(admin);
        airdrop.finish();
        
        assertEq(airdrop.finished(), true);
        assertEq(rmToken.balanceOf(address(airdrop)), 0);
        assertEq(rmToken.balanceOf(admin), adminBalanceBefore + POOL_AMOUNT);
    }
    
    function test_CannotClaimAfterFinish() public {
        vm.prank(admin);
        airdrop.finish();
        
        reviewMe.setReviewCount(user1, 1);
        
        vm.prank(user1);
        vm.expectRevert("Event finished");
        airdrop.claim();
    }
    
    function test_CannotFinishTwice() public {
        vm.startPrank(admin);
        airdrop.finish();
        
        vm.expectRevert("Already finished");
        airdrop.finish();
        vm.stopPrank();
    }
    
    // ============ Pool Empty Tests ============
    
    function test_PoolEmptyReverts() public {
        // Deploy with small pool
        vm.startPrank(admin);
        MockERC20 smallToken = new MockERC20();
        StreakAirdrop smallAirdrop = new StreakAirdrop(address(smallToken), address(reviewMe));
        smallToken.mint(address(smallAirdrop), 5 ether);  // Only 5 RM
        vm.stopPrank();
        
        reviewMe.setReviewCount(user1, 1);
        
        vm.prank(user1);
        vm.expectRevert("Pool empty");
        smallAirdrop.claim();
    }
    
    // ============ View Function Tests ============
    
    function test_GetUserInfo() public {
        // Before any claim
        (uint32 totalStreak, uint8 dayInCycle, , bool canClaim, uint256 reward, string memory status) 
            = airdrop.getUserInfo(user1);
        
        assertEq(totalStreak, 0);
        assertEq(dayInCycle, 0);
        assertEq(canClaim, false);
        assertEq(keccak256(bytes(status)), keccak256(bytes("Write a new review first")));
        
        // After writing review
        reviewMe.setReviewCount(user1, 1);
        (, , , canClaim, reward, status) = airdrop.getUserInfo(user1);
        
        assertEq(canClaim, true);
        assertEq(reward, 10 ether);
        assertEq(keccak256(bytes(status)), keccak256(bytes("Ready to claim!")));
    }
    
    function test_IsActive() public view {
        assertTrue(airdrop.isActive());
    }
    
    function test_IsActiveAfterFinish() public {
        vm.prank(admin);
        airdrop.finish();
        assertFalse(airdrop.isActive());
    }
    
    function test_GetRewards() public view {
        uint256[7] memory rewards = airdrop.getRewards();
        assertEq(rewards[0], 10 ether);
        assertEq(rewards[1], 10 ether);
        assertEq(rewards[2], 10 ether);
        assertEq(rewards[3], 20 ether);
        assertEq(rewards[4], 20 ether);
        assertEq(rewards[5], 20 ether);
        assertEq(rewards[6], 50 ether);
    }
    
    // ============ Multiple Users Test ============
    
    function test_MultipleUsers() public {
        // User 1 claims
        reviewMe.setReviewCount(user1, 1);
        vm.prank(user1);
        airdrop.claim();
        
        // User 2 claims
        reviewMe.setReviewCount(user2, 1);
        vm.prank(user2);
        airdrop.claim();
        
        assertEq(rmToken.balanceOf(user1), 10 ether);
        assertEq(rmToken.balanceOf(user2), 10 ether);
        
        // Next day - different streaks
        vm.warp(block.timestamp + 1 days);
        
        // User 1 continues streak
        reviewMe.setReviewCount(user1, 2);
        vm.prank(user1);
        airdrop.claim();
        
        // User 2 skips
        
        // Day 3
        vm.warp(block.timestamp + 1 days);
        
        // User 1 continues
        reviewMe.setReviewCount(user1, 3);
        vm.prank(user1);
        airdrop.claim();
        
        // User 2 claims (streak reset)
        reviewMe.setReviewCount(user2, 2);
        vm.prank(user2);
        airdrop.claim();
        
        (uint32 streak1, , , , , ) = airdrop.getUserInfo(user1);
        (uint32 streak2, , , , , ) = airdrop.getUserInfo(user2);
        
        assertEq(streak1, 3);  // User 1 has 3-day streak
        assertEq(streak2, 1);  // User 2 reset to 1
    }
}

