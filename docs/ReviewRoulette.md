# Review Roulette

> **Version:** 0.4.0  
> **Deployed:** November 28, 2025  
> **Contract:** `0x27b0887a1d0590bdb7373c3dbe11206dd3e1a5a2` (Base Mainnet)

## Overview

Review Roulette is a gamified airdrop mechanism that incentivizes users to write reviews by rewarding them with 20 RM tokens. Users can spin a slot machine-style roulette every 6 hours to discover new people to review.

### Key Features

- 🎰 **Slot Machine Animation** - Smooth, engaging spin animation with spring physics
- ⏰ **6-Hour Cooldown** - Users can claim once every 6 hours after writing a review
- 🎯 **Pool Filters** - Three options to discover reviewees (Following → Top Users → Products)
- 🛡️ **Self-Review Prevention** - Multi-layer protection against self-reviews
- 📱 **Mobile-First Design** - Floating button on mobile, header link on desktop

---

## Smart Contract

### Contract Details

| Property | Value |
|----------|-------|
| **Address** | `0x27b0887a1d0590bdb7373c3dbe11206dd3e1a5a2` |
| **Network** | Base Mainnet |
| **Solidity Version** | 0.8.20 |
| **License** | MIT |
| **BaseScan** | [View Contract](https://basescan.org/address/0x27b0887a1d0590bdb7373c3dbe11206dd3e1a5a2) |

### Dependencies

| Contract | Address | Purpose |
|----------|---------|---------|
| **RM Token** | `0x37B44b8abB2DeFB35E704306913400888bbdE792` | ERC20 reward token |
| **ReviewMe** | `0x5BfC8705cF877776e461e27FAcB51D8C2bDd00c7` | Review verification |

### Key Functions

#### `claim()`
Claim 20 RM reward after writing a new review.

**Requirements:**
- 6 hours have passed since last claim
- User has written at least one new review since last claim
- Contract has sufficient RM balance

```solidity
function claim() external {
    require(!finished, "Event finished");
    require(block.timestamp >= user.lastClaimTime + COOLDOWN, "Wait 6 hours");
    require(currentReviewCount > user.lastReviewCount, "Write a new review first");
    require(poolBalance >= REWARD, "Pool empty");
    
    // Update state and transfer
    rmToken.transfer(msg.sender, REWARD);
}
```

#### `getUserInfo(address)`
Get user's roulette status for frontend display.

**Returns:**
- `totalClaims` - Total number of successful claims
- `lastClaimTime` - Timestamp of last claim
- `canClaim` - Boolean indicating if user can claim now
- `secondsUntilNextClaim` - Countdown for cooldown
- `status` - Human-readable status message

#### `finish()`
Admin-only function to end the event and refund remaining tokens.

```solidity
function finish() external {
    require(msg.sender == admin, "Not admin");
    require(!finished, "Already finished");
    
    finished = true;
    rmToken.transfer(admin, remaining);
}
```

#### `getTimingInfo()`
Frontend helper to detect production vs test mode.

**Returns:**
- `cooldownSeconds` - 21600 (6 hours)
- `isTestMode` - Always `false` for production contract

---

## Architecture

### File Structure

```
reviewme-fun/
├── app/
│   ├── roulette/
│   │   ├── page.tsx                    # Main roulette page
│   │   ├── components/
│   │   │   └── UserSlotMachine.tsx     # Slot machine animation component
│   │   └── hooks/
│   │       └── useSlotMachine.ts       # Animation state management
│   └── api/
│       └── neynar/
│           └── following/
│               └── route.ts            # Fetch user's following list
├── components/
│   ├── FloatingRouletteButton.tsx      # Mobile floating button
│   ├── Header.tsx                      # Desktop roulette link
│   └── BottomNav.tsx                   # Mobile bottom navigation
├── contracts/
│   ├── ReviewRoulette.sol              # Production contract (6h cooldown)
│   └── ReviewRouletteTest.sol          # Test contract (configurable cooldown)
├── lib/
│   ├── hooks/
│   │   └── useRoulette.ts              # Contract interaction hooks
│   └── roulette-products.ts            # Curated products list
└── scripts/
    ├── deploy-roulette.ts              # Production deployment
    ├── deploy-roulette-test.ts         # Test deployment
    └── finish-roulette-test.ts         # End test event
```

### Component Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     Roulette Page                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Pool Selection: Following | Top Users | Products   │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              UserSlotMachine Component               │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │  [User 1] ─┐                                │    │   │
│  │  │  [User 2] ─┼─► Spinning Animation           │    │   │
│  │  │  [User 3] ─┘    (useSlotMachine hook)       │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Results: Select one of 3 users to review           │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐             │   │
│  │  │ User 1  │  │ User 2  │  │ User 3  │             │   │
│  │  └─────────┘  └─────────┘  └─────────┘             │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  "Make a review for @username" → /review/create     │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Review Completed → "Claim 20 RM" Button            │   │
│  │  (calls ReviewRoulette.claim())                     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Pool Filters

### 1. Following
Fetches 3 random users from the current user's Farcaster following list.

**API:** `/api/neynar/following?fid={userFid}`

**Requirements:**
- User must have a connected Farcaster account
- Fetches up to 100 following users, randomly selects 3

### 2. Top Users
Fetches popular Farcaster users from the power badge holders.

**API:** `/api/neynar/user/batch` with power badge FIDs

**Source:** Neynar API power users endpoint

### 3. Products/Services
Curated list of 45 product/service accounts for users to review.

**Source:** `lib/roulette-products.ts`

**Categories:**
| Category | Examples |
|----------|----------|
| Infra/Chains | Coinbase, Base, Optimism, Arbitrum, Monad |
| DeFi | Aerodrome, Velodrome |
| Wallets | Rainbow, Zerion, MetaMask, Zapper |
| Social | Paragraph, FWB, Talent |
| Products | Mint.club, Warpslot, Farcade, Ponder |

---

## Self-Review Prevention

Three-layer protection to prevent users from reviewing themselves:

### Layer 1: Smart Contract (ReviewMe.sol)
```solidity
address actualReviewer = tx.origin;
require(reviewee != actualReviewer, "Cannot review yourself");
```

### Layer 2: Roulette Results Filtering
```typescript
// Filter out self from spin results
const filteredUsers = users.filter(u => u.fid !== userFid);
```

### Layer 3: Review Create Page
```typescript
const isSelfReview = reviewee?.wallet.toLowerCase() === userAddress?.toLowerCase();
// Shows warning and disables submit button
```

---

## Session State Management

Spin sessions are persisted in `localStorage` to survive page refreshes:

```typescript
interface SpinSession {
  timestamp: number;        // When spin occurred
  results: FarcasterUser[]; // 3 result users
  selectedUser: FarcasterUser | null;
  filter: 'following' | 'top' | 'products';
}

// Storage key
const STORAGE_KEY = 'roulette_spin_session';
```

**Session Lifecycle:**
1. User spins → Session saved to localStorage
2. User navigates away → Session persists
3. User returns → Session restored, results displayed
4. User claims reward → Session cleared, cooldown starts

---

## Animation System

### Slot Machine (UserSlotMachine.tsx)

Uses Framer Motion for smooth animations with GPU acceleration.

**Animation States:**
| State | Description |
|-------|-------------|
| `Idle` | Static display, slight floating animation |
| `Spinning` | Fast vertical scroll through users |
| `Complete` | Lands on winning users with spring effect |

**Performance Optimizations:**
- `will-change: transform, opacity` for GPU acceleration
- `requestAnimationFrame` for smooth updates
- Quartic ease-out for natural slowdown
- Spring physics for landing bounce

**Key Parameters:**
```typescript
const SPIN_DURATION = 3200;     // Total spin time (ms)
const SPIN_SPEED_START = 36;    // Fast initial speed
const SPIN_SPEED_END = 400;     // Slow final speed
const VISIBLE_COUNT = 5;        // Visible slots
const ITEM_HEIGHT = 52;         // Slot item height (px)
```

---

## Environment Variables

### Required
```env
NEXT_PUBLIC_ROULETTE_ADDRESS=0x27b0887a1d0590bdb7373c3dbe11206dd3e1a5a2
NEYNAR_API_KEY=your-neynar-api-key
```

### For Testing (optional)
```env
# Deploy test contract with 5-minute cooldown
NEXT_PUBLIC_ROULETTE_ADDRESS=<test_contract_address>
```

---

## Deployment Scripts

### Deploy Production Contract
```bash
PRIVATE_KEY=0x... npx ts-node scripts/deploy-roulette.ts base-mainnet
```

### Deploy Test Contract (5-min cooldown)
```bash
PRIVATE_KEY=0x... npx ts-node scripts/deploy-roulette-test.ts base-mainnet
```

### Finish Event & Refund Tokens
```bash
PRIVATE_KEY=0x... npx ts-node scripts/finish-roulette-test.ts
```

---

## UI Components

### FloatingRouletteButton (Mobile)
Positioned at bottom-right with glowing pink effect.

```tsx
<Link href="/roulette" className="fixed bottom-24 right-4 z-40">
  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-500 to-purple-600">
    <Dices className="w-6 h-6 text-white" />
  </div>
</Link>
```

### Header Link (Desktop)
Added to the main navigation bar for desktop users.

---

## Testing Checklist

- [ ] Spin with "Following" filter (requires Farcaster account)
- [ ] Spin with "Top Users" filter
- [ ] Spin with "Products" filter
- [ ] Verify slot machine animation is smooth
- [ ] Select a user and navigate to review page
- [ ] Write a review for selected user
- [ ] Return to roulette and claim 20 RM
- [ ] Verify 6-hour cooldown timer appears
- [ ] Verify self-review prevention works
- [ ] Test on mobile (floating button visible)
- [ ] Test on desktop (header link visible)

---

## Troubleshooting

### "Pool empty" Error
The contract has run out of RM tokens. Admin needs to transfer more tokens to the contract address.

### "Write a new review first" Error
User has not written a new review since their last claim. They must write at least one new review.

### "Wait 6 hours between claims" Error
Cooldown period not completed. User must wait for the countdown timer.

### Spin Button Not Working
1. Check browser console for API errors
2. Verify Neynar API key is set correctly
3. Ensure user has Farcaster account (for "Following" filter)

### Animation Jittery
1. Check if browser supports hardware acceleration
2. Try Chrome/Firefox for best performance
3. Close other heavy tabs

---

## Future Improvements

- [ ] Add more pool filter options (e.g., "NFT Collectors", "DeFi Users")
- [ ] Implement daily bonus multipliers
- [ ] Add sound effects for spin/win
- [ ] Create leaderboard for most roulette claims
- [ ] Add referral bonus for inviting friends to roulette

---

## Related Documentation

- [StreakAirdrop.md](./StreakAirdrop.md) - Daily streak reward system
- [CONTRACT.md](./CONTRACT.md) - Main ReviewMe contract documentation
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment procedures

