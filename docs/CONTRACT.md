# ReviewMe v0.01 Contract

## Overview
Single ReviewMe token system with wallet-based on-chain reviews.

## Key Features
- **100 ReviewMe tokens** minted per review
- **Distribution**: 89% reviewer, 10% reviewee, 1% burn
- **Mint.club** bonding curve integration
- **Wallet-based** storage (no FID in contract)
- **Immutable** (no admin functions)

## Contract Details
- **File**: `contracts/ReviewMe_v1.02.sol`
- **Address**: `0x5BfC8705cF877776e461e27FAcB51D8C2bDd00c7` ([BaseScan](https://basescan.org/address/0x5BfC8705cF877776e461e27FAcB51D8C2bDd00c7))
- **Solidity**: 0.8.20
- **Network**: Base Mainnet (Chain ID: 8453)

## Core Functions

### Write Functions
```solidity
submitReview(
  address reviewee,
  string content,    // max 150 chars
  uint8 emoji,       // 1-5
  uint256 maxHuntAmount
) returns (uint256 reviewId)
```

### Read Functions
```solidity
getReviewsForWallet(address wallet, uint256 offset, uint256 limit) returns (Review[], uint256[] reviewIds)
getReviewsByReviewer(address reviewer) returns (Review[], uint256[] reviewIds)
getRecentReviews(uint256 offset, uint256 limit) returns (Review[], uint256[] reviewIds)
getReviewCount(address wallet) returns (uint256)
estimateReviewCost() returns (uint256 huntAmount, uint256 royalty)
totalReviews() returns (uint256)
```

## Review Structure
```solidity
struct Review {
  address reviewer;
  address reviewee;
  string content;
  uint8 emoji;      // 1-5
  uint256 timestamp;
}
```

## Constants
```solidity
REVIEWME_TOKEN = 0x37B44b8abB2DeFB35E704306913400888bbdE792
HUNT_TOKEN = 0x37f0c2915CeCC7e977183B8543Fc0864d03E064C
MINTCLUB_BOND = 0xc5a076cad94176c2996B32d8466Be1cE757FAa27
BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD

TOKENS_PER_REVIEW = 100 ether
REVIEWER_SHARE = 89 ether
REVIEWEE_SHARE = 10 ether
BURN_SHARE = 1 ether
MAX_CONTENT_LENGTH = 150
```

## Events
```solidity
event ReviewSubmitted(
  uint256 indexed reviewId,
  address indexed reviewer,
  address indexed reviewee,
  string content,
  uint8 emoji,
  uint256 timestamp
)
```

## Security
- ✅ ReentrancyGuard
- ✅ Input validation
- ✅ Self-review prevention
- ✅ No admin functions
- ✅ Immutable

## Flow
```
1. User approves HUNT tokens (or contract has max approval from constructor)
2. User calls submitReview()
3. Contract mints 100 ReviewMe via Mint.club
4. Distributes: 89% reviewer, 10% reviewee, 1% burn
5. Stores review data on-chain
6. Emits ReviewSubmitted event
```

## Gas Optimizations (v1.02)
- **Approval moved to constructor**: HUNT token approval is set to `type(uint256).max` in the constructor, eliminating the need for approval in every `submitReview` call.
- **Pagination for getReviewsForWallet**: Added `offset` and `limit` parameters to prevent gas limit errors when wallets have many reviews. Returns reviews in reverse chronological order (newest first).

