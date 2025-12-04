#!/bin/bash

# ReviewMe v0.01 Deployment Script
# This script deploys the ReviewMe_v0_01 contract to Base testnet or mainnet

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if network argument is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Network not specified${NC}"
    echo "Usage: ./scripts/deploy-reviewme-v0.01.sh [testnet|mainnet]"
    exit 1
fi

NETWORK=$1

# Set RPC URL based on network
if [ "$NETWORK" == "testnet" ]; then
    RPC_URL=${BASE_TESTNET_RPC_URL:-"https://sepolia.base.org"}
    CHAIN_ID=84532
    EXPLORER_URL="https://sepolia.basescan.org"
    echo -e "${YELLOW}Deploying to Base Testnet (Sepolia)${NC}"
elif [ "$NETWORK" == "mainnet" ]; then
    RPC_URL=${BASE_MAINNET_RPC_URL:-"https://mainnet.base.org"}
    CHAIN_ID=8453
    EXPLORER_URL="https://basescan.org"
    echo -e "${YELLOW}Deploying to Base Mainnet${NC}"
    echo -e "${RED}WARNING: This will deploy to MAINNET!${NC}"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Deployment cancelled"
        exit 0
    fi
else
    echo -e "${RED}Error: Invalid network. Use 'testnet' or 'mainnet'${NC}"
    exit 1
fi

# Check if private key is set
if [ -z "$PRIVATE_KEY" ]; then
    echo -e "${RED}Error: PRIVATE_KEY environment variable not set${NC}"
    echo "Please set your private key: export PRIVATE_KEY=0x..."
    exit 1
fi

echo -e "${GREEN}Starting deployment...${NC}"
echo "RPC URL: $RPC_URL"
echo "Chain ID: $CHAIN_ID"
echo ""

# Deploy contract using forge
echo -e "${YELLOW}Deploying ReviewMe_v0_01 contract...${NC}"

forge create \
    --rpc-url "$RPC_URL" \
    --private-key "$PRIVATE_KEY" \
    --verify \
    --etherscan-api-key "$BASESCAN_API_KEY" \
    contracts/ReviewMe_v0.01.sol:ReviewMe_v0_01

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Copy the deployed contract address"
    echo "2. Update NEXT_PUBLIC_REVIEWME_CONTRACT_ADDRESS in .env.local"
    echo "3. Verify the contract on $EXPLORER_URL"
    echo "4. Test the contract functions"
else
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi

