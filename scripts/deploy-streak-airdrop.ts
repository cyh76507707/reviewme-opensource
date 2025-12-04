/**
 * StreakAirdrop Deployment Script (TypeScript/Viem)
 * Usage: npx ts-node scripts/deploy-streak-airdrop.ts [network]
 * Networks: local, base-testnet, base-mainnet
 */

import { createWalletClient, createPublicClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';

// Contract addresses
const RM_TOKEN = '0x37B44b8abB2DeFB35E704306913400888bbdE792';
const REVIEWME_CONTRACT = '0x5BfC8705cF877776e461e27FAcB51D8C2bDd00c7';

// StreakAirdrop bytecode (compiled with solc 0.8.20)
// You need to compile the contract first with: forge build
// Then get bytecode from: out/StreakAirdrop.sol/StreakAirdrop.json

async function main() {
  const network = process.argv[2] || 'local';
  
  console.log(`\n🚀 Deploying StreakAirdrop to ${network}...`);
  console.log(`RM Token: ${RM_TOKEN}`);
  console.log(`ReviewMe Contract: ${REVIEWME_CONTRACT}\n`);

  // Get chain config
  let chain;
  let rpcUrl;
  
  switch (network) {
    case 'local':
      chain = { ...base, id: 31337 };
      rpcUrl = 'http://localhost:8545';
      break;
    case 'base-testnet':
      chain = baseSepolia;
      rpcUrl = process.env.BASE_TESTNET_RPC_URL || 'https://sepolia.base.org';
      break;
    case 'base-mainnet':
      chain = base;
      rpcUrl = process.env.BASE_MAINNET_RPC_URL || 'https://mainnet.base.org';
      break;
    default:
      console.error(`Unknown network: ${network}`);
      console.error('Usage: npx ts-node scripts/deploy-streak-airdrop.ts [local|base-testnet|base-mainnet]');
      process.exit(1);
  }

  // Get private key
  let privateKey: `0x${string}`;
  if (network === 'local') {
    // Default Anvil private key
    privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  } else {
    if (!process.env.PRIVATE_KEY) {
      console.error('Error: PRIVATE_KEY environment variable is required for non-local deployments');
      process.exit(1);
    }
    privateKey = process.env.PRIVATE_KEY as `0x${string}`;
  }

  // Read compiled contract
  const outPath = path.join(__dirname, '../out/StreakAirdrop.sol/StreakAirdrop.json');
  if (!fs.existsSync(outPath)) {
    console.error('Compiled contract not found. Please run: forge build');
    process.exit(1);
  }
  
  const compiled = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
  const bytecode = compiled.bytecode.object as `0x${string}`;
  const abi = compiled.abi;

  // Create clients
  const account = privateKeyToAccount(privateKey);
  
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });

  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  console.log(`Deployer: ${account.address}`);
  console.log(`RPC URL: ${rpcUrl}\n`);

  // Deploy contract
  console.log('Deploying contract...');
  
  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    args: [RM_TOKEN, REVIEWME_CONTRACT],
  });

  console.log(`Transaction hash: ${hash}`);
  console.log('Waiting for confirmation...');

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  
  if (!receipt.contractAddress) {
    console.error('Deployment failed - no contract address in receipt');
    process.exit(1);
  }

  console.log(`\n✅ Contract deployed at: ${receipt.contractAddress}`);
  console.log(`Gas used: ${receipt.gasUsed}`);
  
  // Verify admin
  const admin = await publicClient.readContract({
    address: receipt.contractAddress,
    abi,
    functionName: 'admin',
    args: [],
  });
  console.log(`Admin: ${admin}`);

  console.log('\n📋 Next steps:');
  console.log('1. Add to .env:');
  console.log(`   NEXT_PUBLIC_STREAK_AIRDROP_ADDRESS=${receipt.contractAddress}`);
  console.log('2. Transfer RM tokens to the contract');
  console.log('3. Announce the event to users!');
  
  if (network !== 'local') {
    console.log(`\n🔍 View on BaseScan:`);
    const explorerUrl = network === 'base-mainnet' 
      ? 'https://basescan.org' 
      : 'https://sepolia.basescan.org';
    console.log(`   ${explorerUrl}/address/${receipt.contractAddress}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

