/**
 * ReviewRouletteTest Deployment Script (TypeScript/Viem)
 * Deploys with 5-minute cooldown for testing
 * 
 * Usage: npx ts-node scripts/deploy-roulette-test.ts [network]
 * Networks: local, base-testnet, base-mainnet
 */

import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Contract addresses (same as other airdrops)
const RM_TOKEN = '0x37B44b8abB2DeFB35E704306913400888bbdE792';
const REVIEWME_CONTRACT = '0x5BfC8705cF877776e461e27FAcB51D8C2bDd00c7';

// 5 minutes = 300 seconds for testing
const TEST_COOLDOWN = 300;

async function main() {
  const network = process.argv[2] || 'local';
  
  console.log(`\n🎰 Deploying ReviewRouletteTest to ${network}...`);
  console.log(`RM Token: ${RM_TOKEN}`);
  console.log(`ReviewMe Contract: ${REVIEWME_CONTRACT}`);
  console.log(`Cooldown: ${TEST_COOLDOWN} seconds (${TEST_COOLDOWN / 60} minutes)\n`);

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
      console.error('Usage: npx ts-node scripts/deploy-roulette-test.ts [local|base-testnet|base-mainnet]');
      process.exit(1);
  }

  // Get private key
  let privateKey: `0x${string}`;
  if (network === 'local') {
    privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  } else {
    if (!process.env.PRIVATE_KEY) {
      console.error('Error: PRIVATE_KEY environment variable is required for non-local deployments');
      process.exit(1);
    }
    privateKey = process.env.PRIVATE_KEY as `0x${string}`;
  }

  // Read compiled contract
  const outPath = path.join(__dirname, '../out/ReviewRouletteTest.sol/ReviewRouletteTest.json');
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
    args: [RM_TOKEN, REVIEWME_CONTRACT, BigInt(TEST_COOLDOWN)],
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
  
  // Verify contract state
  const [admin, reward, cooldown, timingInfo] = await Promise.all([
    publicClient.readContract({
      address: receipt.contractAddress,
      abi,
      functionName: 'admin',
      args: [],
    }),
    publicClient.readContract({
      address: receipt.contractAddress,
      abi,
      functionName: 'getReward',
      args: [],
    }),
    publicClient.readContract({
      address: receipt.contractAddress,
      abi,
      functionName: 'getCooldown',
      args: [],
    }),
    publicClient.readContract({
      address: receipt.contractAddress,
      abi,
      functionName: 'getTimingInfo',
      args: [],
    }),
  ]);
  
  console.log(`Admin: ${admin}`);
  console.log(`Reward: ${Number(reward) / 1e18} RM`);
  console.log(`Cooldown: ${Number(cooldown)} seconds (${Number(cooldown) / 60} minutes)`);
  console.log(`Test Mode: ${(timingInfo as any)[1] ? 'YES ✅' : 'NO'}`);

  console.log('\n📋 Next steps:');
  console.log('1. Add to .env.local:');
  console.log(`   NEXT_PUBLIC_ROULETTE_ADDRESS=${receipt.contractAddress}`);
  console.log('2. Transfer RM tokens to the contract for testing');
  console.log('3. Test the roulette flow!');
  
  if (network !== 'local') {
    console.log(`\n🔍 View on BaseScan:`);
    const explorerUrl = network === 'base-mainnet' 
      ? 'https://basescan.org' 
      : 'https://sepolia.basescan.org';
    console.log(`   ${explorerUrl}/address/${receipt.contractAddress}`);
  }
  
  console.log('\n⚠️  NOTE: This is a TEST contract with 5-minute cooldown!');
  console.log('    For production, use: npx ts-node scripts/deploy-roulette.ts');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

