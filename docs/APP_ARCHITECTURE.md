# ReviewMe.fun - App Architecture

## Overview

ReviewMe.fun is a **serverless** onchain review platform on Base where users write reviews about people and earn $RM tokens. Built with Next.js 14 (App Router) and deployed on Vercel.

**Contract Address**: `0x5BfC8705cF877776e461e27FAcB51D8C2bDd00c7`

## Tech Stack

- **Framework**: Next.js 14 (App Router, React Server Components)
- **Blockchain**: Base (Ethereum L2)
- **Web3**: wagmi v2 + viem
- **State Management**: React Query (TanStack Query)
- **Styling**: Tailwind CSS
- **Social**: Farcaster (Neynar API)
- **Storage**: IndexedDB (client-side caching)
- **Deployment**: Vercel (serverless)

## Key Architecture Decisions

### 1. **No Database / Fully Serverless**
- All data lives onchain (reviews, tokens)
- No backend server or database
- API routes only for proxying external APIs (Neynar, RPC)

### 2. **Client-Side RPC Calls**
- Direct blockchain reads from browser using `viem`
- Multiple RPC fallback endpoints for reliability
- See `lib/reviewme-contract.ts` for RPC configuration

### 3. **Aggressive Caching Strategy**
```
React Query (in-memory) → IndexedDB (persistent) → RPC/API
```
- **React Query**: 5min stale time for most data
- **IndexedDB**: Persistent cache for profiles and reviews
- Minimizes RPC calls and improves performance

## Project Structure

```
reviewme-fun/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes (Neynar proxy, review endpoints)
│   ├── review/            # Review pages (create, view)
│   ├── token/             # Token info page
│   ├── leaderboard/       # Leaderboard page
│   ├── my-page/           # User's own page
│   └── user/[address]/    # User profile pages
├── lib/
│   ├── reviewme-contract.ts  # Contract ABI, address, core functions
│   ├── wagmi.ts              # Wagmi config (wallet connectors)
│   ├── hooks/
│   │   ├── useReview.ts      # Review data fetching + IndexedDB cache
│   │   ├── useNeynar.ts      # Farcaster profiles + IndexedDB cache
│   │   └── useTokenInfo.ts   # Token price/stats from RPC
│   └── db.ts                 # IndexedDB utilities
├── components/            # React components
└── docs/                  # Documentation
```

## Core Hooks

### `useReview` (lib/hooks/useReview.ts)
- Fetches reviews from contract via RPC
- Caches in IndexedDB for 5 minutes
- Functions: `useRecentReviews`, `useReviewsForWallet`, `useReviewById`

### `useNeynar` (lib/hooks/useNeynar.ts)
- Fetches Farcaster profiles via Neynar API
- Batch API for multiple addresses
- Caches in IndexedDB (never expires unless manually cleared)
- Functions: `useProfile`, `useProfiles`

### `useTokenInfo` (lib/hooks/useTokenInfo.ts)
- Fetches RM token price, market cap, 24h change
- Direct RPC calls to 1inch, Mint.club contracts
- 1-minute cache + auto-refetch

## Smart Contract Integration

### ReviewMe Contract (`lib/reviewme-contract.ts`)

**Key Functions:**
- `getRecentReviews(offset, limit)` - Fetch recent reviews
- `getReviewsByReviewer(address)` - Reviews written by user
- `getReviewsByReviewee(address)` - Reviews received by user
- `getReview(reviewId)` - Single review by ID
- `createReview(reviewee, content, emoji)` - Write a review (costs 100 RM to mint)

**Token Economics:**
- 100 RM minted per review
- 89 RM → Reviewer
- 10 RM → Reviewee
- 1 RM → Burned

### RPC Configuration
```typescript
// lib/reviewme-contract.ts
export const BASE_RPC_ENDPOINTS = [
  'https://mainnet.base.org',
  'https://developer-access-mainnet.base.org',
  'https://base-mainnet.public.blastapi.io',
  // ... 10+ fallback endpoints
];
```

## Caching Strategy

### IndexedDB Schema
```typescript
// Stores: 'profiles', 'reviews'
{
  profiles: {
    key: walletAddress,
    value: { profile: FarcasterProfile | null, timestamp }
  },
  reviews: {
    key: `${type}_${address}`, // e.g., "wallet_0x123..."
    value: { reviews: Review[], timestamp }
  }
}
```

### Cache Invalidation
- **Profiles**: Never expires (manual clear only)
- **Reviews**: 5 minutes
- **Token Info**: 1 minute

## Environment Variables

```bash
# Required
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
NEYNAR_API_KEY=your_neynar_key

# Optional (uses fallback if not set)
NEXT_PUBLIC_REVIEWME_CONTRACT_ADDRESS=0x5BfC8705cF877776e461e27FAcB51D8C2bDd00c7
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org
```

## Common Development Tasks

### Adding a New Review Feature
1. Update contract ABI in `lib/reviewme-contract.ts` if needed
2. Add hook in `lib/hooks/useReview.ts`
3. Add IndexedDB caching if appropriate
4. Create UI component in `components/`

### Adding a New Page
1. Create page in `app/[page-name]/page.tsx`
2. Use existing hooks for data fetching
3. Follow mobile-first responsive design

### Debugging RPC Issues
- Check browser console for RPC errors
- Verify contract address in `lib/reviewme-contract.ts`
- Test individual RPC endpoints (see `BASE_RPC_ENDPOINTS`)
- Check Vercel environment variables

## Performance Tips

1. **Always use React Query** for data fetching (built-in caching)
2. **Add IndexedDB cache** for frequently accessed data
3. **Batch API calls** when fetching multiple items (e.g., profiles)
4. **Use Skeleton UIs** for loading states
5. **Minimize RPC calls** - check cache first

## Deployment

1. Push to `main` branch → Vercel auto-deploys
2. Environment variables set in Vercel dashboard
3. No build-time data fetching (all dynamic/client-side)

## Troubleshooting

### "Contract function returned no data"
- Wrong contract address or ABI mismatch
- Check `NEXT_PUBLIC_REVIEWME_CONTRACT_ADDRESS` in Vercel

### Slow loading / RPC timeouts
- RPC endpoint issues (check `BASE_RPC_ENDPOINTS`)
- Add more fallback RPCs or reorder by reliability

### Profiles not loading
- Neynar API key issue
- Check `NEYNAR_API_KEY` in environment variables
- Verify batch API endpoint in `app/api/neynar/user/batch/route.ts`

### IndexedDB not working
- Browser privacy mode blocks IndexedDB
- Check `lib/db.ts` for errors in console
- Clear site data and refresh

## Key Files to Know

- **`lib/reviewme-contract.ts`** - Contract integration (READ THIS FIRST)
- **`lib/hooks/useReview.ts`** - Review data fetching
- **`lib/hooks/useNeynar.ts`** - Profile data fetching
- **`lib/wagmi.ts`** - Wallet connection config
- **`app/review/create/page.tsx`** - Review creation flow

## Additional Resources

- [Contract Details](./CONTRACT.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Base Chain Docs](https://docs.base.org)
- [wagmi Docs](https://wagmi.sh)
- [Neynar API Docs](https://docs.neynar.com)

