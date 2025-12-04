# Deployment Guide

## Quick Start

### Prerequisites
- MetaMask with Base Mainnet (Chain ID: 8453)
- ~0.003 ETH for gas
- Contract: `contracts/ReviewMe_v0.01.sol`

### Base Mainnet Setup
```
Network: Base
RPC: https://mainnet.base.org
Chain ID: 8453
Explorer: https://basescan.org
```

## Deploy via Remix

### 1. Prepare Contract
1. Go to https://remix.ethereum.org
2. Install OpenZeppelin: `npm install @openzeppelin/contracts@5.0.0`
3. Create `ReviewMe_v0.01.sol` and paste contract code

### 2. Compile
- Compiler: **0.8.20**
- Optimization: **Enabled (200 runs)**
- Click "Compile"

### 3. Deploy
- Environment: **Injected Provider - MetaMask**
- Verify Base Mainnet connected
- Select: **ReviewMe_v0_01**
- Click "Deploy"
- Confirm in MetaMask
- **Save contract address!**

### 4. Verify on BaseScan
1. Go to https://basescan.org
2. Search contract address
3. Click "Verify and Publish"
4. Settings: Solidity 0.8.20, Optimization Yes (200 runs)
5. Paste contract code

### 5. Update Frontend
Add to `.env.local`:
```bash
NEXT_PUBLIC_REVIEWME_CONTRACT_ADDRESS=0x...
```

Restart: `npm run dev`

## Testing

### 1. Get HUNT Tokens
- Buy from Mint.club
- Address: `0x37f0c2915CeCC7e977183B8543Fc0864d03E064C`

### 2. Submit Test Review
1. Go to `/review`
2. Search Farcaster user
3. Select emoji (1-5)
4. Write review (max 150 chars)
5. Approve HUNT
6. Submit review

### 3. Verify Distribution
- Your wallet: ~89 ReviewMe tokens
- Reviewee wallet: ~10 ReviewMe tokens
- Burn address: ~1 ReviewMe token

## Gas Costs (Base Mainnet)
- Deploy: ~0.002-0.003 ETH
- HUNT Approve: ~0.0001 ETH
- Submit Review: ~0.0005-0.001 ETH

## Troubleshooting

**"Insufficient funds"** → Add more ETH

**"Transaction reverted"** → Check HUNT balance, approval, emoji (1-5), content length (≤150)

**"Wrong network"** → Switch to Base Mainnet

**Review not showing** → Check contract address in `.env.local`, restart server

## Contract Addresses (Base Mainnet)
- **ReviewMe Contract**: `0x5BfC8705cF877776e461e27FAcB51D8C2bDd00c7` ([BaseScan](https://basescan.org/address/0x5BfC8705cF877776e461e27FAcB51D8C2bDd00c7))
- **ReviewMe Token**: `0x37B44b8abB2DeFB35E704306913400888bbdE792`
- **HUNT Token**: `0x37f0c2915CeCC7e977183B8543Fc0864d03E064C`
- **Mint.club Bond**: `0xc5a076cad94176c2996B32d8466Be1cE757FAa27`
- **Burn Address**: `0x000000000000000000000000000000000000dEaD`

