#!/bin/bash

# StreakAirdrop Deployment Script
# Usage: ./scripts/deploy-streak-airdrop.sh [network]
# Networks: local, base-testnet, base-mainnet

set -e

# Contract addresses
RM_TOKEN="0x37B44b8abB2DeFB35E704306913400888bbdE792"
REVIEWME_CONTRACT="0x5BfC8705cF877776e461e27FAcB51D8C2bDd00c7"

NETWORK=${1:-local}

echo "🚀 Deploying StreakAirdrop to $NETWORK..."
echo "RM Token: $RM_TOKEN"
echo "ReviewMe Contract: $REVIEWME_CONTRACT"
echo ""

case $NETWORK in
  local)
    RPC_URL="http://localhost:8545"
    ;;
  base-testnet)
    RPC_URL="${BASE_TESTNET_RPC_URL:-https://sepolia.base.org}"
    ;;
  base-mainnet)
    RPC_URL="${BASE_MAINNET_RPC_URL:-https://mainnet.base.org}"
    ;;
  *)
    echo "Unknown network: $NETWORK"
    echo "Usage: ./scripts/deploy-streak-airdrop.sh [local|base-testnet|base-mainnet]"
    exit 1
    ;;
esac

echo "RPC URL: $RPC_URL"

# Check if forge is installed
if command -v forge &> /dev/null; then
    echo "Using Foundry for deployment..."
    
    # Build contracts
    forge build
    
    # Deploy
    if [ "$NETWORK" = "local" ]; then
        # For local, use default anvil private key
        PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    else
        if [ -z "$PRIVATE_KEY" ]; then
            echo "Error: PRIVATE_KEY environment variable is required for non-local deployments"
            exit 1
        fi
    fi
    
    forge create contracts/StreakAirdrop.sol:StreakAirdrop \
        --rpc-url "$RPC_URL" \
        --private-key "$PRIVATE_KEY" \
        --constructor-args "$RM_TOKEN" "$REVIEWME_CONTRACT" \
        --verify \
        --etherscan-api-key "$BASESCAN_API_KEY"
else
    echo "Forge not found. Please install Foundry:"
    echo "curl -L https://foundry.paradigm.xyz | bash"
    echo "foundryup"
    echo ""
    echo "Or use the Node.js deployment script:"
    echo "npx ts-node scripts/deploy-streak-airdrop.ts $NETWORK"
    exit 1
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Transfer RM tokens to the deployed contract address"
echo "2. Update NEXT_PUBLIC_STREAK_AIRDROP_ADDRESS in your .env"
echo "3. Announce the event to users!"

