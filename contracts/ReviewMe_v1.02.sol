// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IMintClubBond {
    function mint(
        address token,
        uint256 tokensToMint,
        uint256 maxReserveAmount,
        address receiver
    ) external payable returns (uint256);

    function getPriceForTokens(
        address token,
        uint256 amount
    ) external view returns (uint256 reserveAmount, uint256 royalty);
}

contract ReviewMe_v1_02 is ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public constant REVIEWME_TOKEN = 0x37B44b8abB2DeFB35E704306913400888bbdE792;
    address public constant HUNT_TOKEN = 0x37f0c2915CeCC7e977183B8543Fc0864d03E064C;
    address public constant MINTCLUB_BOND = 0xc5a076cad94176c2996B32d8466Be1cE757FAa27;
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    uint256 public constant TOKENS_PER_REVIEW = 100 ether;
    uint256 public constant REVIEWER_SHARE = 89 ether;
    uint256 public constant REVIEWEE_SHARE = 10 ether;
    uint256 public constant BURN_SHARE = 1 ether;
    uint256 public constant MAX_CONTENT_LENGTH = 150;

    struct Review {
        address reviewer;
        address reviewee;
        string content;
        uint8 emoji;
        uint256 timestamp;
    }

    Review[] public reviews;
    mapping(address => uint256[]) public reviewsByReviewee;
    mapping(address => uint256[]) public reviewsByReviewer;
    uint256 public totalReviews;

    constructor() {
        IERC20(HUNT_TOKEN).approve(MINTCLUB_BOND, type(uint256).max);
    }

    event ReviewSubmitted(
        uint256 indexed reviewId,
        address indexed reviewer,
        address indexed reviewee,
        string content,
        uint8 emoji,
        uint256 timestamp
    );

    function submitReview(
        address reviewee,
        string calldata content,
        uint8 emoji,
        uint256 maxHuntAmount
    ) external nonReentrant returns (uint256 reviewId) {
        require(emoji >= 1 && emoji <= 5, "Invalid emoji");
        require(reviewee != address(0), "Invalid reviewee");
        require(bytes(content).length <= MAX_CONTENT_LENGTH, "Content too long");

        address actualReviewer = tx.origin;
        require(reviewee != actualReviewer, "Cannot review yourself");

        IERC20(HUNT_TOKEN).safeTransferFrom(msg.sender, address(this), maxHuntAmount);

        uint256 huntUsed = IMintClubBond(MINTCLUB_BOND).mint(
            REVIEWME_TOKEN,
            TOKENS_PER_REVIEW,
            maxHuntAmount,
            address(this)
        );

        if (huntUsed < maxHuntAmount) {
            uint256 refund = maxHuntAmount - huntUsed;
            IERC20(HUNT_TOKEN).safeTransfer(actualReviewer, refund);
        }

        IERC20(REVIEWME_TOKEN).safeTransfer(actualReviewer, REVIEWER_SHARE);
        IERC20(REVIEWME_TOKEN).safeTransfer(reviewee, REVIEWEE_SHARE);
        IERC20(REVIEWME_TOKEN).safeTransfer(BURN_ADDRESS, BURN_SHARE);

        reviewId = reviews.length;
        reviews.push(Review({
            reviewer: actualReviewer,
            reviewee: reviewee,
            content: content,
            emoji: emoji,
            timestamp: block.timestamp
        }));

        reviewsByReviewee[reviewee].push(reviewId);
        reviewsByReviewer[actualReviewer].push(reviewId);
        totalReviews++;

        emit ReviewSubmitted(reviewId, actualReviewer, reviewee, content, emoji, block.timestamp);
    }

    function getReviewsForWallet(
        address wallet,
        uint256 offset,
        uint256 limit
    ) external view returns (Review[] memory, uint256[] memory) {
        uint256[] memory allReviewIds = reviewsByReviewee[wallet];
        
        if (offset >= allReviewIds.length) {
            return (new Review[](0), new uint256[](0));
        }

        uint256 end = offset + limit;
        if (end > allReviewIds.length) {
            end = allReviewIds.length;
        }

        uint256 resultLength = end - offset;
        Review[] memory walletReviews = new Review[](resultLength);
        uint256[] memory reviewIds = new uint256[](resultLength);
        
        for (uint256 i = 0; i < resultLength; i++) {
            uint256 index = allReviewIds.length - 1 - offset - i;
            uint256 reviewId = allReviewIds[index];
            walletReviews[i] = reviews[reviewId];
            reviewIds[i] = reviewId;
        }
        
        return (walletReviews, reviewIds);
    }

    function getRecentReviews(uint256 offset, uint256 limit) external view returns (Review[] memory, uint256[] memory) {
        if (offset >= reviews.length) {
            return (new Review[](0), new uint256[](0));
        }

        uint256 end = offset + limit;
        if (end > reviews.length) {
            end = reviews.length;
        }

        uint256 resultLength = end - offset;
        Review[] memory recentReviews = new Review[](resultLength);
        uint256[] memory reviewIds = new uint256[](resultLength);

        for (uint256 i = 0; i < resultLength; i++) {
            uint256 reviewIndex = reviews.length - 1 - offset - i;
            recentReviews[i] = reviews[reviewIndex];
            reviewIds[i] = reviewIndex;
        }

        return (recentReviews, reviewIds);
    }

    function getReviewCount(address wallet) external view returns (uint256) {
        return reviewsByReviewee[wallet].length;
    }

    function getReviewsByReviewer(address reviewer) external view returns (Review[] memory, uint256[] memory) {
        uint256[] memory reviewIds = reviewsByReviewer[reviewer];
        Review[] memory reviewerReviews = new Review[](reviewIds.length);
        
        for (uint256 i = 0; i < reviewIds.length; i++) {
            reviewerReviews[i] = reviews[reviewIds[i]];
        }
        
        return (reviewerReviews, reviewIds);
    }

    function estimateReviewCost() external view returns (uint256 huntAmount, uint256 royalty) {
        return IMintClubBond(MINTCLUB_BOND).getPriceForTokens(
            REVIEWME_TOKEN,
            TOKENS_PER_REVIEW
        );
    }
}

