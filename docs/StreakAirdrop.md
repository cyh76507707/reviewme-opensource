# StreakAirdrop System

A 7-day streak reward system for ReviewMe.fun that incentivizes daily review writing.

## Contract Details

| Field | Value |
|-------|-------|
| **Address** | `0x6099E29684e99cc332FF856739845E7C2bf51284` |
| **Network** | Base Mainnet |
| **Solidity** | 0.8.20 |
| **Source** | `contracts/StreakAirdrop.sol` |

### Dependencies

| Contract | Address |
|----------|---------|
| RM Token | `0x37B44b8abB2DeFB35E704306913400888bbdE792` |
| ReviewMe | `0x5BfC8705cF877776e461e27FAcB51D8C2bDd00c7` |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    StreakAirdrop                        │
├─────────────────────────────────────────────────────────┤
│  State Variables:                                       │
│  - rmToken (IERC20)        → RM token for rewards       │
│  - reviewMe (IReviewMe)    → Verifies review count      │
│  - admin (address)         → Deployer, can finish event │
│  - finished (bool)         → Event ended flag           │
│  - users (mapping)         → UserState per wallet       │
│  - rewards (uint256[7])    → [10,10,10,20,20,20,50] RM  │
├─────────────────────────────────────────────────────────┤
│  UserState:                                             │
│  - lastClaimDay (uint64)   → Unix day of last claim     │
│  - lastReviewCount (uint64)→ Review count at last claim │
│  - totalStreak (uint32)    → Consecutive days claimed   │
└─────────────────────────────────────────────────────────┘
```

---

## Core Logic

### Day Calculation

```solidity
uint64 today = uint64(block.timestamp / 1 days);  // 86400 seconds
```

- Days are based on **UTC midnight** (00:00 UTC)
- `block.timestamp / 86400` gives the Unix day number

### Streak Rules

1. **First claim**: `totalStreak = 1`
2. **Consecutive day** (lastClaimDay == today - 1): `totalStreak++`
3. **Missed day(s)**: `totalStreak = 1` (reset)

### Reward Cycle

```
totalStreak:  1   2   3   4   5   6   7   8   9  10  ...
dayInCycle:   1   2   3   4   5   6   7   1   2   3  ...
reward (RM): 10  10  10  20  20  20  50  10  10  10  ...
```

Formula: `dayInCycle = ((totalStreak - 1) % 7) + 1`

---

## Functions

### User Functions

#### `claim()`

Claims daily reward. Requirements:
- Event not finished
- User wrote a new review since last claim
- User hasn't claimed today
- Pool has sufficient balance

```solidity
function claim() external;
```

### View Functions

#### `getUserInfo(address)`

Returns user's current streak status.

```solidity
function getUserInfo(address userAddr) external view returns (
    uint32 totalStreak,      // Total consecutive days
    uint8 currentDayInCycle, // 1-7 in current cycle
    uint64 lastClaimDay,     // Unix day of last claim
    bool canClaimToday,      // Can claim right now?
    uint256 todayReward,     // Reward amount if claimed
    string memory status     // Human-readable status
);
```

**Status values:**
- `"Ready to claim!"`
- `"Already claimed today"`
- `"Write a new review first"`
- `"Pool empty"`
- `"Event finished"`

#### `getPoolBalance()`

```solidity
function getPoolBalance() external view returns (uint256);
```

#### `isActive()`

```solidity
function isActive() external view returns (bool);
// Returns: !finished && balance >= 10 RM
```

#### `getRewards()`

```solidity
function getRewards() external view returns (uint256[7] memory);
// Returns: [10e18, 10e18, 10e18, 20e18, 20e18, 20e18, 50e18]
```

### Admin Functions

#### `finish()`

Ends the event and refunds remaining tokens to admin.

```solidity
function finish() external;  // Only callable by admin
```

---

## Frontend Integration

### Files

| File | Purpose |
|------|---------|
| `lib/hooks/useStreak.ts` | React hooks for contract interaction |
| `app/streak/page.tsx` | Streak page UI |
| `components/Header.tsx` | Desktop nav link |
| `components/BottomNav.tsx` | Mobile nav link |

### Environment Variable

```bash
NEXT_PUBLIC_STREAK_AIRDROP_ADDRESS=0x6099E29684e99cc332FF856739845E7C2bf51284
```

### Hooks

```typescript
import { 
  useStreakInfo,      // User's streak data
  usePoolInfo,        // Pool balance & rewards
  useTimingInfo,      // Countdown timer data
  useClaimStreak,     // Claim mutation
  useIsStreakConfigured 
} from '@/lib/hooks/useStreak';
```

### Example Usage

```typescript
const { data: streakInfo } = useStreakInfo();
const claimMutation = useClaimStreak();

// Check if user can claim
if (streakInfo?.canClaimToday) {
  await claimMutation.mutateAsync();
}
```

---

## Review Verification

The contract calls `ReviewMe.getReviewsByReviewer(wallet)` to count reviews **written by** the user (not reviews received).

```solidity
(, uint256[] memory reviewIds) = reviewMe.getReviewsByReviewer(msg.sender);
uint64 currentReviewCount = uint64(reviewIds.length);
require(currentReviewCount > user.lastReviewCount, "Write a new review first");
```

This ensures users must write a **new review** each day to claim rewards.

---

## Testing

### Local Testing

```bash
# Run Foundry tests
forge test -vvv

# Test file
test/StreakAirdrop.t.sol
```

### Test Contract (Configurable Day Length)

For testing with shorter day lengths, use `contracts/StreakAirdropTest.sol` which accepts a `dayLength` parameter in the constructor.

---

## Deployment

### Deploy New Contract

```bash
# Using Foundry
source .env.local
forge create contracts/StreakAirdrop.sol:StreakAirdrop \
  --rpc-url https://mainnet.base.org \
  --private-key $PRIVATE_KEY \
  --constructor-args \
    0x37B44b8abB2DeFB35E704306913400888bbdE792 \
    0x5BfC8705cF877776e461e27FAcB51D8C2bDd00c7 \
  --broadcast
```

### Fund the Pool

Transfer RM tokens directly to the contract address.

### End the Event

```bash
cast send 0x6099E29684e99cc332FF856739845E7C2bf51284 \
  "finish()" \
  --rpc-url https://mainnet.base.org \
  --private-key $PRIVATE_KEY
```

---

## Monitoring

### Check Pool Balance

```bash
cast call 0x6099E29684e99cc332FF856739845E7C2bf51284 \
  "getPoolBalance()" \
  --rpc-url https://mainnet.base.org | xargs cast --from-wei
```

### Check User Info

```bash
cast call 0x6099E29684e99cc332FF856739845E7C2bf51284 \
  "getUserInfo(address)" \
  0xYOUR_WALLET_ADDRESS \
  --rpc-url https://mainnet.base.org
```

---

## Events

```solidity
event Claimed(
    address indexed user,
    uint32 totalStreak,
    uint8 dayInCycle,
    uint256 reward
);

event EventFinished(uint256 remainingTokens);
```

---

## Security Considerations

1. **Admin is immutable** - Set at deployment, cannot be changed
2. **No reentrancy risk** - State updated before transfer
3. **Integer overflow safe** - Solidity 0.8+ built-in checks
4. **Pool drainage protected** - Checks balance before transfer

---

## Event Timeline

- **Launch**: November 27, 2025
- **End**: December 31, 2025
- **Pool**: 109,790 RM (as of launch)

---

## Links

- [Contract on BaseScan](https://basescan.org/address/0x6099E29684e99cc332FF856739845E7C2bf51284)
- [RM Token on BaseScan](https://basescan.org/token/0x37B44b8abB2DeFB35E704306913400888bbdE792)
- [Streak Page](https://reviewme.fun/streak)

