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
| RPC fallback | `lib/reviewme-contract.ts`, `lib/rpc.ts` |
| Local caching | `lib/cache.ts` |
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
3. [RPC Fallback Strategy](#3-rpc-fallback-strategy)
4. [Local Caching Strategy](#4-local-caching-strategy)
5. [Sending Notifications](#5-sending-notifications)
6. [Deployment via Vercel](#6-deployment-via-vercel)
7. [Setting up Supabase](#7-setting-up-supabase)
8. [Creating HUNT-backed Token](#8-creating-hunt-backed-token-via-hunttown)
9. [Smart Contract Development](#9-smart-contract-development)
10. [Setting up Farcaster Manifest](#10-setting-up-farcaster-manifest)
11. [Base.dev Preview Setup](#11-basedev-preview-setup)
12. [Key SDK Features to Know](#12-key-sdk-features-to-know)
13. [Sharing Your App](#13-sharing-your-app)
14. [Authentication](#14-authentication)
15. [Lessons Learned & Gotchas](#15-lessons-learned--gotchas)
16. [Important Guidelines for AI Agents](#16-important-guidelines-for-ai-agents)

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
- Users don't see a wallet selection dialog when inside Farcaster
- Fallback to other wallets (MetaMask, Coinbase, etc.) in browser

---

## 3. RPC Fallback Strategy

### Why Fallback is Essential

Public Base RPC endpoints get rate-limited frequently. Without fallback, your app becomes unusable when the primary RPC fails.

**Reference**: See `lib/reviewme-contract.ts` and `lib/rpc.ts`

### ReviewMe's RPC Endpoint List

We use 10+ fallback endpoints with automatic rotation:

```
https://base-rpc.publicnode.com
https://base.drpc.org
https://base.llamarpc.com
https://base.meowrpc.com
https://mainnet.base.org
https://developer-access-mainnet.base.org
https://base-mainnet.public.blastapi.io
https://base-public.nodies.app
https://rpc.poolz.finance/base
https://api.zan.top/base-mainnet
https://1rpc.io/base
https://endpoints.omniatech.io/v1/base/mainnet/public
https://base.public.blockpi.network/v1/rpc/public
```

### Implementation Pattern

**Key principles:**
1. **Create ONE reusable module** - Don't copy RPC logic to multiple places
2. **Use wagmi's `fallback()` transport** - Sequential fallback with short timeouts
3. **Set aggressive timeouts** - 2-3 seconds max per endpoint
4. **Disable retries per endpoint** - Move to next endpoint immediately on failure
5. **Allow custom RPC via env** - `NEXT_PUBLIC_BASE_RPC_URL` gets highest priority

### Configuration Tips

| Setting | Recommended Value | Reason |
|---------|-------------------|--------|
| Timeout | 2,000ms | Fail fast, try next |
| Retry count | 0 | Don't waste time retrying failed endpoint |
| Rank mode | `false` | Sequential order, not performance-based |

---

## 4. Local Caching Strategy

### Why Cache Aggressively?

In ReviewMe, we reduced RPC calls by 80%+ with proper caching:
- Reviews are immutable (cache forever)
- Transaction hashes never change (cache forever)
- Profiles change rarely (cache 1 hour)
- Recent data needs refresh (cache 1-5 minutes)

**Reference**: See `lib/cache.ts` for our complete caching implementation.

### Cache Architecture

| Data Type | Storage | TTL | Reason |
|-----------|---------|-----|--------|
| Individual reviews | IndexedDB | 24 hours | Large objects, immutable |
| Transaction hashes | localStorage | Forever | Small, immutable |
| User profiles (Neynar) | IndexedDB | 1 hour | Can change, moderate size |
| Recent reviews list | IndexedDB | 1 minute | Needs freshness |
| Reviews per wallet | IndexedDB | 5 minutes | Balance freshness vs. load |

### IndexedDB for Large Data

Use IndexedDB (not localStorage) for:
- Large objects (reviews with content)
- Collections of data
- Anything over 5KB

### Cache Pattern for Neynar API Calls

**Strategy:**
1. Check IndexedDB cache first
2. If hit and not expired → return cached
3. If miss or expired → fetch from Neynar API
4. Store result in cache (including `null` for non-existent users)
5. Return result

**Important**: Cache `null` results too! If a wallet has no Farcaster profile, cache that fact to avoid repeated API calls.

### Garbage Collection

Run cache cleanup on app initialization:
- Delete entries older than 7 days
- Delete expired entries
- Increment DB version to force reset when schema changes

---

## 5. Sending Notifications

**Official Docs**: [miniapps.farcaster.xyz/docs/guides/notifications](https://miniapps.farcaster.xyz/docs/guides/notifications)

### Architecture Decision: Self-Hosted vs Managed

We chose **self-hosted notifications** for ReviewMe.fun:

| Approach | Cost | Complexity |
|----------|------|------------|
| **Neynar Managed** | $9-249/month | Low - they handle webhooks |
| **Self-Hosted** | $0 (Supabase free tier) | Medium - you store tokens |

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

---

## 6. Deployment via Vercel

### Environment Variables

| Variable | Exposure | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Client | WalletConnect |
| `NEYNAR_API_KEY` | Server only | User profiles, webhook verification |
| `DATABASE_URL` | Server only | Supabase/Postgres |
| `CRON_SECRET` | Server only | Secure cron endpoints |

**Reference**: See `.env.example` for all available environment variables.

> ⚠️ Never expose `NEYNAR_API_KEY` as `NEXT_PUBLIC_` - it's server-side only.

### Cron Jobs

Vercel supports cron jobs via `vercel.json`. We use them for:
- Weekly summary notifications (Sunday 8 PM UTC)
- Daily leaderboard updates (9 AM UTC)

**Reference**: See `vercel.json` for cron configuration.

---

## 7. Setting up Supabase

**Official Docs**: [supabase.com/docs](https://supabase.com/docs)

### Why Supabase?

For ReviewMe.fun notifications:
- **Free tier** handles 10,000+ users easily
- PostgreSQL with Prisma ORM
- 500 MB database, 5 GB bandwidth/month

**Reference**: See `prisma/schema.prisma` for our database schema.

---

## 8. Creating HUNT-backed Token via Hunt.Town

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

---

## 9. Smart Contract Development

**Foundry Docs**: [book.getfoundry.sh](https://book.getfoundry.sh)

**Reference**: See `contracts/` directory for all smart contracts.

### Key Lessons

1. **Approve in constructor**: Set `type(uint256).max` approval for Mint.club Bond in constructor to save gas per transaction
2. **Pagination**: Add `offset` and `limit` to getter functions to prevent gas limit errors with large datasets
3. **Use `tx.origin`**: For reviewer attribution when contract calls come through the app
4. **Fork testing**: Use `vm.createSelectFork("base_mainnet")` to test against real state

**Reference**: See `docs/DEPLOYMENT.md` and `docs/CONTRACT.md` for detailed guides.

---

## 10. Setting up Farcaster Manifest

**Official Docs**: [miniapps.farcaster.xyz/docs/guides/publishing](https://miniapps.farcaster.xyz/docs/guides/publishing)

### Generate Account Association

Use the manifest tool: [farcaster.xyz/~/developers/mini-apps/manifest](https://farcaster.xyz/~/developers/mini-apps/manifest)

**Reference**: See `public/.well-known/farcaster.json` for our manifest template.

> ⚠️ Domain in manifest must **exactly match** your hosting domain.

### Force Refresh Manifest

After updating your manifest, force Farcaster to re-fetch it:

**Path**: Farcaster → Developers → Manifests → Refresh

(Select your domain and click refresh to pull the latest manifest)

---

## 11. Base.dev Preview Setup

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

## 12. Key SDK Features to Know

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

---

## 13. Sharing Your App

**Official Docs**: [miniapps.farcaster.xyz/docs/guides/sharing](https://miniapps.farcaster.xyz/docs/guides/sharing)

### Embed Meta Tag

Add `fc:miniapp` meta tag to pages you want shareable as rich cards in feeds.

Key requirements:
- Image must be **3:2 aspect ratio**
- Min 600x400px, max 3000x2000px
- Button title max 32 characters
- Use PNG format for best compatibility

---

## 14. Authentication

**Official Docs**: [miniapps.farcaster.xyz/docs/guides/auth](https://miniapps.farcaster.xyz/docs/guides/auth)

### Quick Auth (Recommended)

Simplest approach - handles token management automatically:

```typescript
const res = await sdk.quickAuth.fetch('https://your-api.com/me');
```

---

## 15. Lessons Learned & Gotchas

### From Building ReviewMe.fun

1. **Call `ready()` early** - Show skeleton UI, then load data
2. **RPC fallback is essential** - Public endpoints get rate-limited
3. **Farcaster connector first** - Ensures auto-connect in Farcaster client
4. **Self-hosted notifications work** - Supabase free tier is sufficient
5. **Pagination in contracts** - Prevents gas limit errors at scale
6. **IndexedDB caching** - Reduces RPC calls by 80%+
7. **Test on production domain** - Many features only work there
8. **Cache null results** - Avoid repeated API calls for non-existent data

### Common Mistakes

| Mistake | Solution |
|---------|----------|
| Infinite loading screen | Call `sdk.actions.ready()` |
| `addMiniApp()` fails | Must use production domain |
| Webhook verification fails | Check `NEYNAR_API_KEY` is set |
| Notifications not received | Verify `webhookUrl` in manifest |
| RPC rate limited | Implement fallback with multiple endpoints |

---

## 16. Important Guidelines for AI Agents

### ⚠️ Critical Rules

From the [official checklist](https://miniapps.farcaster.xyz/docs/guides/agents-checklist):

- **DO NOT** use Frames v1 syntax (`fc:frame:image`, etc.)
- **DO NOT** invent manifest fields
- **DO NOT** use `fc:frame` meta tag for new apps (use `fc:miniapp`)
- **ALWAYS** use version "1" (not "next")
- **ALWAYS** verify against official SDK schema

### 📦 Always Use Latest Package Versions

> ⚠️ **AI agents often suggest outdated package versions from training data. ALWAYS check for latest versions.**

When setting up `package.json` for the first time:

1. **Check npm for latest versions** before adding any package:
   - Visit `https://www.npmjs.com/package/<package-name>` 
   - Or run `npm show <package-name> version`

2. **Key packages to verify** (versions change frequently):

   **Core Framework & Runtime:**
   | Package | Check Latest | Notes |
   |---------|--------------|-------|
   | `node` | [nodejs.org](https://nodejs.org/) | Mini Apps require 22.11.0+ |
   | `next` | [npm](https://www.npmjs.com/package/next) | Check App Router compatibility |
   | `react` | [npm](https://www.npmjs.com/package/react) | Must match Next.js requirements |
   | `react-dom` | [npm](https://www.npmjs.com/package/react-dom) | Same version as react |
   | `typescript` | [npm](https://www.npmjs.com/package/typescript) | |

   **Farcaster Mini App:**
   | Package | Check Latest |
   |---------|--------------|
   | `@farcaster/miniapp-sdk` | [npm](https://www.npmjs.com/package/@farcaster/miniapp-sdk) |
   | `@farcaster/miniapp-wagmi-connector` | [npm](https://www.npmjs.com/package/@farcaster/miniapp-wagmi-connector) |
   | `@farcaster/miniapp-node` | [npm](https://www.npmjs.com/package/@farcaster/miniapp-node) |
   | `@farcaster/quick-auth` | [npm](https://www.npmjs.com/package/@farcaster/quick-auth) |

   **Web3 / Wallet:**
   | Package | Check Latest | Notes |
   |---------|--------------|-------|
   | `wagmi` | [npm](https://www.npmjs.com/package/wagmi) | v2.x requires viem v2.x |
   | `viem` | [npm](https://www.npmjs.com/package/viem) | Must align with wagmi |
   | `@rainbow-me/rainbowkit` | [npm](https://www.npmjs.com/package/@rainbow-me/rainbowkit) | Check wagmi compatibility |
   | `@tanstack/react-query` | [npm](https://www.npmjs.com/package/@tanstack/react-query) | Required by wagmi |

   **Database & Backend:**
   | Package | Check Latest |
   |---------|--------------|
   | `@prisma/client` | [npm](https://www.npmjs.com/package/@prisma/client) |
   | `prisma` | [npm](https://www.npmjs.com/package/prisma) |

   **UI & Styling:**
   | Package | Check Latest |
   |---------|--------------|
   | `tailwindcss` | [npm](https://www.npmjs.com/package/tailwindcss) |
   | `framer-motion` | [npm](https://www.npmjs.com/package/framer-motion) |
   | `lucide-react` | [npm](https://www.npmjs.com/package/lucide-react) |

3. **Don't trust AI-suggested versions** - They may be months or years outdated
4. **Check peer dependency compatibility** - Especially for wagmi/viem/rainbowkit which must align

**Example**: Instead of blindly using:
```json
"wagmi": "^1.0.0"  // ❌ Old version from AI training data
```
Always verify:
```bash
npm show wagmi version  // Returns current: 2.x.x
```

---

### 🚫 Development Anti-Patterns

**1. No Mock/Temp/Fake Code**
- Never generate placeholder implementations with `// TODO: implement later`
- Never create fake API responses or mock data for production code
- If a feature requires external data, implement the actual data fetching

**2. No Hard-Coding Without Proper Logic**
- Don't hard-code values that should come from configuration or API
- Always use environment variables for configurable values
- Implement proper error handling, not just happy-path code

**3. Modularize Reusable Logic**
- Create ONE shared module for repeated logic (e.g., RPC fallback, caching)
- Don't copy-paste the same code to multiple places
- Example: RPC endpoints should be in a single `lib/rpc.ts`, imported everywhere

**4. Confirm Before Heavy Changes**
- Before implementing features that change architecture (e.g., serverless → server-side)
- Before adding new dependencies that affect build/deploy
- Before restructuring database schema
- **Always ask the project owner** about risks, tradeoffs, and operational impact

### 💡 Lessons from ReviewMe Development

**What Worked Well:**
- Starting with a simple contract, iterating based on real usage
- Using Vercel's serverless for zero-ops deployment
- IndexedDB + localStorage caching strategy
- Self-hosted notifications (no monthly cost)
- Multiple RPC fallback endpoints

**What Caused Problems:**
- Initial single RPC endpoint → constant failures
- Not caching null results → excessive API calls
- Large getter functions without pagination → gas limit errors
- Testing only on localhost → missed production-only bugs

**Architecture Decisions That Matter:**
- **Serverless vs Server**: Serverless is simpler for small apps. If you need WebSockets, persistent connections, or heavy background jobs, discuss with owner first.
- **Self-hosted vs Managed**: Self-hosted notifications saved ~$100/month but required more initial setup.
- **Client-side vs Server-side RPC**: Client-side reduces server load but exposes RPC endpoints. Server-side is more secure but adds latency.

### 📋 Before Starting Any Task

1. **Understand the existing architecture** - Read relevant files before proposing changes
2. **Check for existing utilities** - Don't recreate what already exists
3. **Verify with official docs** - SDK and API patterns change; always check latest docs
4. **Consider operational impact** - Will this change affect monitoring, costs, or maintenance?
5. **Ask if uncertain** - Better to clarify than to implement incorrectly

---

## Quick Reference Links

### Official Documentation
- [Mini Apps Getting Started](https://miniapps.farcaster.xyz/docs/getting-started)
- [Mini Apps Full LLM Reference](https://miniapps.farcaster.xyz/llms-full.txt)
- [SDK Reference](https://miniapps.farcaster.xyz/docs/sdk)
- [Notifications Guide](https://miniapps.farcaster.xyz/docs/guides/notifications)
- [Publishing Guide](https://miniapps.farcaster.xyz/docs/guides/publishing)
- [AI Agent Checklist](https://miniapps.farcaster.xyz/docs/guides/agents-checklist)

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
