# Building a Farcaster Mini App: Complete Guide

> A knowledge-focused guide for building and deploying a Farcaster Mini App, based on lessons learned from developing [ReviewMe.fun](https://reviewme.fun).

**For AI Agents**: This guide focuses on concepts, gotchas, and decision points rather than code snippets. Use official documentation links for implementation details. **You can also explore the source code in this repository as a working reference implementation.**

---

## 📁 Reference Implementation

This repository contains the complete source code for **ReviewMe.fun** - an on-chain review platform built on Base. Use it as a reference for:

| Feature | Files to Check |
|---------|----------------|
| Mini App SDK setup | `lib/miniapp.ts`, `components/providers/FrameProvider.tsx` |
| Wallet integration | `lib/wagmi.ts`, `components/providers/RainbowKitProvider.tsx` |
| Notification system | `lib/notification.server.ts`, `app/api/farcaster/webhook/route.ts` |
| Smart contracts | `contracts/ReviewMe_v1.02.sol` |
| Prisma schema | `prisma/schema.prisma` |
| Farcaster manifest | `public/.well-known/farcaster.json` (template) |
| API routes | `app/api/` directory |
| Cron jobs | `vercel.json` |

### Quick Start with This Code

```bash
# Clone and install
git clone <this-repo>
cd reviewme-opensource
npm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with your values

# Setup database
npx prisma generate
npx prisma migrate dev

# Run development server
npm run dev
```

---

## Table of Contents

1. [Farcaster Mini App Setup](#1-farcaster-mini-app-setup)
2. [RainbowKit & Wallet Integration](#2-rainbowkit--wallet-integration)
3. [Sending Notifications](#3-sending-notifications)
4. [Deployment via Vercel](#4-deployment-via-vercel)
5. [Setting up Supabase](#5-setting-up-supabase)
6. [Creating HUNT-backed Token](#6-creating-hunt-backed-token-via-hunttown)
7. [Smart Contract Development](#7-smart-contract-development)
8. [Setting up Farcaster Manifest](#8-setting-up-farcaster-manifest)
9. [Base.dev Preview Setup](#9-basedev-preview-setup)
10. [Key SDK Features to Know](#10-key-sdk-features-to-know)
11. [Sharing Your App](#11-sharing-your-app)
12. [Authentication](#12-authentication)
13. [Lessons Learned & Gotchas](#13-lessons-learned--gotchas)

---

## 1. Farcaster Mini App Setup

**Official Docs**: [miniapps.farcaster.xyz/docs/getting-started](https://miniapps.farcaster.xyz/docs/getting-started)

### Quick Start

```bash
npm create @farcaster/mini-app
```

For manual setup, CDN options, and alternative package managers, see the [official getting started guide](https://miniapps.farcaster.xyz/docs/getting-started).

### Requirements
- **Node.js 22.11.0 or higher** - This is strict. Earlier versions cause cryptic installation errors.
- Enable Developer Mode: [farcaster.xyz/~/settings/developer-tools](https://farcaster.xyz/~/settings/developer-tools)

### Critical First Lesson: Call `ready()`

> ⚠️ **The #1 beginner mistake**: If you don't call `sdk.actions.ready()`, users see an infinite loading screen.

After your app loads, you **must** call `sdk.actions.ready()` to hide the splash screen. In React, do this in a `useEffect` hook.

**Reference**: See `components/providers/FrameProvider.tsx` for our implementation.

### Key Packages

| Package | Purpose |
|---------|---------|
| `@farcaster/miniapp-sdk` | Core SDK for mini app features |
| `@farcaster/miniapp-wagmi-connector` | Farcaster wallet connector for wagmi |
| `@farcaster/miniapp-node` | Server-side webhook handling |
| `@farcaster/quick-auth` | Server-side JWT validation |

---

## 2. RainbowKit & Wallet Integration

**Official Docs**: [rainbowkit.com/docs/installation](https://rainbowkit.com/docs/installation)

### Why RainbowKit?

For ReviewMe.fun, we used RainbowKit because:
- Provides beautiful, customizable wallet connection UI
- Works seamlessly with wagmi hooks
- Handles multiple wallet types gracefully
- SSR-compatible with Next.js

### Setup Overview

1. Install: `npm install @rainbow-me/rainbowkit wagmi viem @tanstack/react-query`
2. Get a WalletConnect Project ID from [cloud.walletconnect.com](https://cloud.walletconnect.com)
3. Configure wagmi with `@farcaster/miniapp-wagmi-connector` as the **first** connector (highest priority for auto-connect in mini app context)
4. Wrap your app with `WagmiProvider` → `QueryClientProvider` → `RainbowKitProvider`

**Reference**: See `lib/wagmi.ts` for our complete configuration.

### Key Decision: Farcaster Connector Priority

When configuring wagmi connectors, put `farcasterMiniApp()` **first** in the array. This ensures:
- Auto-connect works in Farcaster client context
- Users don't see a wallet selection dialog when inside Warpcast
- Fallback to other wallets (MetaMask, Coinbase, etc.) in browser

### RPC Fallback Strategy

We learned to configure **multiple fallback RPC endpoints** for reliability:
- Public Base RPC endpoints get rate-limited
- Use 5-10 fallback endpoints with short timeouts
- Consider paid RPC (Alchemy, QuickNode) for production

**Reference**: See `lib/reviewme-contract.ts` for our RPC fallback list.

---

## 3. Sending Notifications

**Official Docs**: [miniapps.farcaster.xyz/docs/guides/notifications](https://miniapps.farcaster.xyz/docs/guides/notifications)

### Architecture Decision: Self-Hosted vs Managed

We chose **self-hosted notifications** for ReviewMe.fun:

| Approach | Cost | Complexity |
|----------|------|------------|
| **Neynar Managed** | $9-249/month | Low - they handle webhooks |
| **Self-Hosted** | $0 (Supabase free tier) | Medium - you store tokens |

Self-hosted approach:
1. Receive webhook at `/api/farcaster/webhook` when users add/remove your app
2. Store notification tokens in your database (we use Prisma + Supabase)
3. POST directly to Farcaster's notification endpoint when sending

**Reference**: See `lib/notification.server.ts` and `app/api/farcaster/webhook/route.ts`

### Key Gotchas

- **Rate limits**: 1 notification per 30 seconds per user, 100 per day
- **Idempotency**: Use stable `notificationId` to prevent duplicates
- **Token cleanup**: Automatically remove invalid tokens from API responses
- **Domain matching**: `targetUrl` must be on your app's domain

### Webhook Events

Handle these four events:
- `miniapp_added` - Save notification token
- `miniapp_removed` - Delete token
- `notifications_enabled` - Save new token
- `notifications_disabled` - Delete token

Use `@farcaster/miniapp-node` with `parseWebhookEvent` and `verifyAppKeyWithNeynar` for secure webhook handling.

---

## 4. Deployment via Vercel

### Environment Variables

| Variable | Exposure | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Client | WalletConnect |
| `NEYNAR_API_KEY` | Server only | User profiles, webhook verification |
| `DATABASE_URL` | Server only | Supabase/Postgres |
| `CRON_SECRET` | Server only | Secure cron endpoints |

> ⚠️ Never expose `NEYNAR_API_KEY` as `NEXT_PUBLIC_` - it's server-side only.

**Reference**: See `.env.example` for all available environment variables.

### Cron Jobs

Vercel supports cron jobs via `vercel.json`. We use them for:
- Weekly summary notifications (Sunday 8 PM UTC)
- Daily leaderboard updates (9 AM UTC)

Secure cron endpoints with `CRON_SECRET` or Vercel's built-in authorization.

**Reference**: See `vercel.json` for cron configuration.

---

## 5. Setting up Supabase

**Official Docs**: [supabase.com/docs](https://supabase.com/docs)

### Why Supabase?

For ReviewMe.fun notifications:
- **Free tier** handles 10,000+ users easily
- PostgreSQL with Prisma ORM
- 500 MB database, 5 GB bandwidth/month

### Schema Design

Our notification schema stores:
- User FID (unique identifier)
- Notification token + URL (from Farcaster webhook)
- Notification log (for deduplication and analytics)

Use Prisma for migrations: `npx prisma migrate dev`

**Reference**: See `prisma/schema.prisma` for our database schema.

---

## 6. Creating HUNT-backed Token via Hunt.Town

**Launch at**: [hunt.town](https://hunt.town/)

### Process

1. Connect wallet (Base network)
2. Click "Launch" → Enter token name, symbol, description, logo
3. Configure bonding curve parameters
4. Optional: Donate HUNT for visibility boost
5. Confirm transaction

### Key Addresses (Base Mainnet)

| Contract | Address |
|----------|---------|
| HUNT Token | `0x37f0c2915CeCC7e977183B8543Fc0864d03E064C` |
| Mint.club Bond | `0xc5a076cad94176c2996B32d8466Be1cE757FAa27` |

Your smart contract interacts with the Mint.club Bond to mint tokens on the bonding curve.

---

## 7. Smart Contract Development

**Foundry Docs**: [book.getfoundry.sh](https://book.getfoundry.sh)

### Our Stack

- **Foundry** for development, testing, deployment
- **OpenZeppelin** for security primitives (ReentrancyGuard, SafeERC20)
- **Remix** as alternative deployment option

**Reference**: See `contracts/` directory for all smart contracts.

### Key Lessons

1. **Approve in constructor**: Set `type(uint256).max` approval for Mint.club Bond in constructor to save gas per transaction
2. **Pagination**: Add `offset` and `limit` to getter functions to prevent gas limit errors with large datasets
3. **Use `tx.origin`**: For reviewer attribution when contract calls come through the app
4. **Fork testing**: Use `vm.createSelectFork("base_mainnet")` to test against real state

### Deployment Options

1. **Forge Script**: `forge script scripts/Deploy.s.sol --rpc-url base_mainnet --broadcast --verify`
2. **Remix**: Connect MetaMask, compile with 0.8.20, optimization enabled (200 runs)

### Verification

```bash
forge verify-contract <ADDRESS> ContractName --chain-id 8453 --etherscan-api-key $BASESCAN_API_KEY
```

**Reference**: See `docs/DEPLOYMENT.md` and `docs/CONTRACT.md` for detailed guides.

---

## 8. Setting up Farcaster Manifest

**Official Docs**: [miniapps.farcaster.xyz/docs/guides/publishing](https://miniapps.farcaster.xyz/docs/guides/publishing)

### Generate Account Association

Use the manifest tool: [farcaster.xyz/~/developers/mini-apps/manifest](https://farcaster.xyz/~/developers/mini-apps/manifest)

> ⚠️ Domain in manifest must **exactly match** your hosting domain.

### Manifest Location

Host at `/.well-known/farcaster.json` or use Farcaster's hosted manifest service with a redirect.

**Reference**: See `public/.well-known/farcaster.json` for our manifest template.

### Required vs Optional Fields

**Required**: `version`, `name`, `iconUrl`, `homeUrl`

**For App Store Discovery**: Add `description`, `screenshotUrls`, `primaryCategory`, `tags`

**For Notifications**: Add `webhookUrl`

### Force Refresh

After updating manifest: Warpcast → Settings → Developer Tools → Domains → Refresh

---

## 9. Base.dev Preview Setup

**Preview Tool**: [base.dev/preview](https://www.base.dev/preview)

Also use Farcaster's official tools:
- **Preview**: [farcaster.xyz/~/developers/mini-apps/preview](https://farcaster.xyz/~/developers/mini-apps/preview)
- **Embed Debug**: [farcaster.xyz/~/developers/mini-apps/embed](https://farcaster.xyz/~/developers/mini-apps/embed)

### Testing Workflow

1. Use ngrok for HTTPS tunnel during development
2. **Open tunnel URL in browser first** to whitelist it
3. Test in preview tools
4. Deploy to production for testing `addMiniApp()` and manifest-dependent features

> ⚠️ `addMiniApp()` only works on production domains matching your manifest.

---

## 10. Key SDK Features to Know

**Full SDK Reference**: [miniapps.farcaster.xyz/docs/sdk](https://miniapps.farcaster.xyz/docs/sdk)

### Must-Know Actions

| Action | Purpose |
|--------|---------|
| `sdk.actions.ready()` | **Required** - Hide splash screen |
| `sdk.actions.addMiniApp()` | Prompt user to add app |
| `sdk.actions.composeCast()` | Open cast composer with prefilled content |
| `sdk.actions.openUrl()` | Open external URL |
| `sdk.actions.close()` | Close mini app |

### Wallet & Token Actions

| Action | Purpose |
|--------|---------|
| `sdk.actions.swapToken()` | Open token swap UI |
| `sdk.actions.sendToken()` | Open token send UI |
| `sdk.actions.viewToken()` | View token details |
| `sdk.actions.viewProfile()` | View Farcaster profile |

### Utility Features

| Feature | Purpose |
|---------|---------|
| `sdk.haptics.*` | Haptic feedback (impact, notification, selection) |
| `sdk.back.*` | Back navigation integration |
| `sdk.isInMiniApp()` | Detect mini app environment |
| `sdk.getCapabilities()` | Check host capabilities |
| `sdk.context` | Get user, client, and location info |

---

## 11. Sharing Your App

**Official Docs**: [miniapps.farcaster.xyz/docs/guides/sharing](https://miniapps.farcaster.xyz/docs/guides/sharing)

### Embed Meta Tag

Add `fc:miniapp` meta tag to pages you want shareable as rich cards in feeds.

Key requirements:
- Image must be **3:2 aspect ratio**
- Min 600x400px, max 3000x2000px
- Button title max 32 characters
- Use PNG format for best compatibility

### Universal Links

Your app gets a canonical URL: `https://farcaster.xyz/miniapps/<app-id>/<app-slug>`

Find it in: Developers page → kebab menu → "Copy link to mini app"

---

## 12. Authentication

**Official Docs**: [miniapps.farcaster.xyz/docs/guides/auth](https://miniapps.farcaster.xyz/docs/guides/auth)

### Quick Auth (Recommended)

Simplest approach - handles token management automatically:

```typescript
const res = await sdk.quickAuth.fetch('https://your-api.com/me');
```

Server-side validation with `@farcaster/quick-auth`:
- Verify JWT with `client.verifyJwt({ token, domain })`
- Get user FID from `payload.sub`

### Performance Tip

Add preconnect hint: `<link rel="preconnect" href="https://auth.farcaster.xyz" />`

---

## 13. Lessons Learned & Gotchas

### From Building ReviewMe.fun

1. **Call `ready()` early** - Show skeleton UI, then load data
2. **RPC fallback is essential** - Public endpoints get rate-limited
3. **Farcaster connector first** - Ensures auto-connect in Warpcast
4. **Self-hosted notifications work** - Supabase free tier is sufficient
5. **Pagination in contracts** - Prevents gas limit errors at scale
6. **IndexedDB caching** - Reduces RPC calls significantly
7. **Test on production domain** - Many features only work there

### Common Mistakes

| Mistake | Solution |
|---------|----------|
| Infinite loading screen | Call `sdk.actions.ready()` |
| `addMiniApp()` fails | Must use production domain |
| Webhook verification fails | Check `NEYNAR_API_KEY` is set |
| Notifications not received | Verify `webhookUrl` in manifest |
| Wrong network | Use Base Mainnet (Chain ID: 8453) |

### AI/LLM Pitfalls

From the [official checklist](https://miniapps.farcaster.xyz/docs/guides/agents-checklist):

- **DO NOT** use Frames v1 syntax (`fc:frame:image`, etc.)
- **DO NOT** invent manifest fields
- **DO NOT** use `fc:frame` meta tag for new apps (use `fc:miniapp`)
- **ALWAYS** use version "1" (not "next")
- **ALWAYS** verify against official SDK schema

---

## Quick Reference Links

### Official Documentation
- [Mini Apps Getting Started](https://miniapps.farcaster.xyz/docs/getting-started)
- [Mini Apps Full LLM Reference](https://miniapps.farcaster.xyz/llms-full.txt)
- [SDK Reference](https://miniapps.farcaster.xyz/docs/sdk)
- [Notifications Guide](https://miniapps.farcaster.xyz/docs/guides/notifications)
- [Publishing Guide](https://miniapps.farcaster.xyz/docs/guides/publishing)

### Developer Tools
- [Developer Mode](https://farcaster.xyz/~/settings/developer-tools)
- [Manifest Tool](https://farcaster.xyz/~/developers/mini-apps/manifest)
- [Preview Tool](https://farcaster.xyz/~/developers/mini-apps/preview)
- [Embed Debug Tool](https://farcaster.xyz/~/developers/mini-apps/embed)

### External Services
- [RainbowKit](https://rainbowkit.com/docs/installation)
- [Neynar API](https://docs.neynar.com)
- [Hunt Town](https://hunt.town)
- [Supabase](https://supabase.com/docs)
- [WalletConnect Cloud](https://cloud.walletconnect.com)
- [Foundry Book](https://book.getfoundry.sh)

### Base Network
- [Base.dev Preview](https://www.base.dev/preview)
- [BaseScan](https://basescan.org)
- Base Mainnet RPC: `https://mainnet.base.org`
- Chain ID: 8453

---

## License

MIT

---

*Created based on the development of [ReviewMe.fun](https://reviewme.fun) - An on-chain review platform on Base.*
