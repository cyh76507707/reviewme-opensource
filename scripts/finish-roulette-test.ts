/**
 * Finish Test Roulette Contract - Refunds remaining RM tokens to admin
 * Usage: PRIVATE_KEY=0x... npx ts-node scripts/finish-roulette-test.ts
 */

import { createWalletClient, createPublicClient, http, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const TEST_ROULETTE_ADDRESS = '0x8c4addf73e8f83f1748c8e75c48097bd6792c8fe' as `0x${string}`;

const ROULETTE_ABI = [
  {
    type: 'function',
    name: 'finish',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'finished',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'getPoolBalance',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'admin',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'event',
    name: 'EventFinished',
    inputs: [
      { name: 'remainingTokens', type: 'uint256', indexed: false },
    ],
  },
] as const;

async function main() {
  console.log('\n🛑 Finishing Test Roulette Contract...');
  console.log(`Contract: ${TEST_ROULETTE_ADDRESS}\n`);

  if (!process.env.PRIVATE_KEY) {
    console.error('Error: PRIVATE_KEY environment variable is required');
    console.error('Usage: PRIVATE_KEY=0x... npx ts-node scripts/finish-roulette-test.ts');
    process.exit(1);
  }

  const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({
    chain: base,
    transport: http('https://mainnet.base.org'),
  });

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http('https://mainnet.base.org'),
  });

  console.log(`Admin wallet: ${account.address}`);

  // Check current state
  const [isFinished, poolBalance] = await Promise.all([
    publicClient.readContract({
      address: TEST_ROULETTE_ADDRESS,
      abi: ROULETTE_ABI,
      functionName: 'finished',
    }),
    publicClient.readContract({
      address: TEST_ROULETTE_ADDRESS,
      abi: ROULETTE_ABI,
      functionName: 'getPoolBalance',
    }),
  ]);

  console.log(`Already finished: ${isFinished}`);
  console.log(`Pool balance: ${formatEther(poolBalance)} RM\n`);

  if (isFinished) {
    console.log('✅ Contract is already finished. No action needed.');
    return;
  }

  // Call finish()
  console.log('Calling finish()...');
  
  const hash = await walletClient.writeContract({
    address: TEST_ROULETTE_ADDRESS,
    abi: ROULETTE_ABI,
    functionName: 'finish',
  });

  console.log(`Transaction hash: ${hash}`);
  console.log('Waiting for confirmation...');

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status === 'success') {
    console.log(`\n✅ Test contract finished successfully!`);
    console.log(`   ${formatEther(poolBalance)} RM returned to admin`);
    console.log(`   Gas used: ${receipt.gasUsed}`);
    console.log(`\n🔍 View on BaseScan:`);
    console.log(`   https://basescan.org/tx/${hash}`);
  } else {
    console.error('❌ Transaction failed');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

