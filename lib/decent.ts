/**
 * Decent.xyz Box API Integration
 * Handles multi-token payment for ReviewMe reviews via Decent swap routing
 */

import {
  bigintSerializer,
  bigintDeserializer,
  ActionType,
  BoxActionRequest,
  ChainId,
} from '@decent.xyz/box-common';
import { publicClient } from './reviewme-contract';
import { REVIEWME_CONTRACT_ADDRESS, HUNT_TOKEN_ADDRESS } from './reviewme-contract';
import {
  PAYMENT_TOKENS,
  type PaymentToken,
  type TokenInfo,
} from '@/config/tokens';
import { encodeFunctionData, formatUnits } from 'viem';

// Decent API configuration
const DECENT_API_URL = 'https://box-v4.api.decent.xyz/api/getBoxAction';
const DECENT_API_KEY = process.env.NEXT_PUBLIC_DECENT_API_KEY || '';

// Re-export types for convenience
export type { PaymentToken, TokenInfo };

interface DecentTransactionConfig {
  txConfig: BoxActionRequest;
}

interface DecentTransactionResult {
  tx: {
    to: string;
    data: string;
    value: string;
    from?: string;
    gasLimit?: string;
  };
  tokenPayment: {
    tokenAddress: string;
    amount: string;
    isNative: boolean;
  };
}

/**
 * Prepare a Decent transaction for signing with a non-HUNT token
 */
export async function prepareDecentTransaction(
  config: DecentTransactionConfig
): Promise<DecentTransactionResult> {
  const url = new URL(DECENT_API_URL);
  url.searchParams.set(
    'arguments',
    JSON.stringify(config.txConfig, bigintSerializer)
  );

  console.log('[Decent API] Request config:', config.txConfig);

  const requestOptions: RequestInit = {
    method: 'GET',
    headers: {
      'x-api-key': DECENT_API_KEY,
    },
  };

  const response = await fetch(url.toString(), requestOptions);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Decent API] Error response:', response.status, errorText);
    throw new Error(
      `Decent API error: ${response.status} ${response.statusText}`
    );
  }

  const textResponse = await response.text();
  const result = JSON.parse(textResponse, bigintDeserializer);

  // Check if API returned an error
  if (result.success === false || result.error) {
    const errorMessage =
      result.error?.message || 'Unknown error from Decent API';
    console.error('[Decent API] API returned error:', result.error);
    throw new Error(errorMessage);
  }

  // Handle both possible response structures
  const tokenPayment = result.tokenPayment || {
    tokenAddress: result.tokenAddress,
    amount: result.amount || result.tx?.value,
    isNative: result.isNative || false,
  };

  return {
    tx: result.tx,
    tokenPayment: tokenPayment,
  };
}

/**
 * Create a BoxActionRequest for submitting a review with a non-HUNT token
 */
export function createReviewConfig(
  senderAddress: `0x${string}`,
  srcToken: PaymentToken,
  reviewee: `0x${string}`,
  content: string,
  emoji: number,
  huntAmount: bigint
): BoxActionRequest {
  const tokenInfo = PAYMENT_TOKENS[srcToken];

  const config: BoxActionRequest = {
    actionType: ActionType.EvmFunction,
    sender: senderAddress,
    srcToken: tokenInfo.address,
    dstToken: HUNT_TOKEN_ADDRESS,
    slippage: 1, // 1% slippage
    srcChainId: ChainId.BASE,
    dstChainId: ChainId.BASE,
    actionConfig: {
      chainId: ChainId.BASE,
      contractAddress: REVIEWME_CONTRACT_ADDRESS,
      cost: {
        amount: huntAmount,
        isNative: false,
        tokenAddress: HUNT_TOKEN_ADDRESS,
      },
      signature:
        'function submitReview(address reviewee,string calldata content,uint8 emoji,uint256 maxHuntAmount)',
      args: [reviewee, content, emoji, huntAmount],
    },
  };

  return config;
}

/**
 * Execute a Decent transaction using the wallet with batch approval support
 */
export async function executeDecentTransaction(
  senderAddress: `0x${string}`,
  signerClient: any,
  srcToken: PaymentToken,
  reviewee: `0x${string}`,
  content: string,
  emoji: number,
  huntAmount: bigint
): Promise<`0x${string}`> {
  if (!signerClient) {
    throw new Error('No wallet client available');
  }

  // Create the transaction config
  const txConfig = createReviewConfig(
    senderAddress,
    srcToken,
    reviewee,
    content,
    emoji,
    huntAmount
  );

  // Get the transaction from Decent API
  const { tx, tokenPayment } = await prepareDecentTransaction({ txConfig });

  const tokenInfo = PAYMENT_TOKENS[srcToken];
  let approvalTx: { to: string; data: string; value: string } | null = null;

  // For non-native tokens (like USDC, MT), check balance and prepare approval if needed
  if (!tokenInfo.isNative && tokenPayment) {
    // Check token balance
    const balance = await publicClient.readContract({
      address: tokenInfo.address,
      abi: [
        {
          inputs: [{ name: 'account', type: 'address' }],
          name: 'balanceOf',
          outputs: [{ name: '', type: 'uint256' }],
          stateMutability: 'view',
          type: 'function',
        },
      ],
      functionName: 'balanceOf',
      args: [senderAddress],
    });

    const requiredAmount = BigInt(tokenPayment.amount);

    if (balance < requiredAmount) {
      throw new Error(
        `Insufficient ${srcToken} balance. You need ${formatUnits(
          requiredAmount,
          tokenInfo.decimals
        )} ${srcToken} but only have ${formatUnits(
          balance,
          tokenInfo.decimals
        )} ${srcToken}.`
      );
    }

    // Check if approval is needed
    const currentAllowance = await publicClient.readContract({
      address: tokenInfo.address,
      abi: [
        {
          inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
          ],
          name: 'allowance',
          outputs: [{ name: '', type: 'uint256' }],
          stateMutability: 'view',
          type: 'function',
        },
      ],
      functionName: 'allowance',
      args: [senderAddress, tx.to as `0x${string}`],
    });

    if (currentAllowance < requiredAmount) {
      // Encode approval transaction
      const approvalData = encodeFunctionData({
        abi: [
          {
            inputs: [
              { name: 'spender', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
            name: 'approve',
            outputs: [{ name: '', type: 'bool' }],
            stateMutability: 'nonpayable',
            type: 'function',
          },
        ],
        functionName: 'approve',
        args: [tx.to as `0x${string}`, requiredAmount],
      });

      approvalTx = {
        to: tokenInfo.address,
        data: approvalData,
        value: '0x0',
      };
    }
  }

  // Convert value to proper format
  const txValue =
    typeof tx.value === 'bigint' ? tx.value : BigInt(tx.value || '0');

  // Prepare main transaction
  const mainTx = {
    to: tx.to,
    data: tx.data,
    value: `0x${txValue.toString(16)}`,
  };

  let hash: string;
  let isBatchTransaction = false;

  // If approval is needed, try batch transaction first
  if (approvalTx) {
    try {
      const calls = [
        {
          to: approvalTx.to,
          data: approvalTx.data,
          value: approvalTx.value,
        },
        {
          to: mainTx.to,
          data: mainTx.data,
          value: mainTx.value,
        },
      ];

      const batchId = await signerClient.request({
        method: 'wallet_sendCalls',
        params: [
          {
            version: '2.0.0',
            chainId: `0x${Number(8453).toString(16)}`,
            from: senderAddress,
            calls,
            atomicRequired: true,
          },
        ],
      });

      // Extract the actual batch ID string from the response
      if (typeof batchId === 'string') {
        hash = batchId;
      } else if (batchId && typeof batchId === 'object') {
        hash =
          (batchId as any).id ||
          (batchId as any).bundleId ||
          (batchId as any).batchId ||
          JSON.stringify(batchId);
      } else {
        hash = String(batchId);
      }

      isBatchTransaction = true;
    } catch (batchError: any) {
      // Check if user rejected the transaction
      if (
        batchError.code === 4001 ||
        batchError.message?.toLowerCase().includes('user rejected') ||
        batchError.message?.toLowerCase().includes('user denied')
      ) {
        throw new Error('Transaction rejected by user');
      }

      // Check if the method is truly unsupported
      const isMethodUnsupported =
        batchError.code === -32601 ||
        batchError.message?.toLowerCase().includes('does not exist') ||
        batchError.message?.toLowerCase().includes('not supported') ||
        batchError.message?.toLowerCase().includes('does not support') ||
        batchError.message?.toLowerCase().includes('method not found');

      if (!isMethodUnsupported) {
        throw batchError;
      }

      // Fallback: Send approval first, then main transaction
      const approvalHash = await signerClient.sendTransaction({
        account: senderAddress as `0x${string}`,
        to: approvalTx.to as `0x${string}`,
        data: approvalTx.data as `0x${string}`,
        value: BigInt(0),
      });

      console.log('Waiting for approval confirmation...');
      await publicClient.waitForTransactionReceipt({
        hash: approvalHash as `0x${string}`,
      });
      console.log('Approval confirmed');

      // Additional wait to ensure all RPC endpoints are synced
      // This prevents "insufficient allowance" errors due to RPC fallback delays
      console.log('Waiting for RPC sync...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      const mainHash = await signerClient.sendTransaction({
        account: senderAddress as `0x${string}`,
        to: mainTx.to as `0x${string}`,
        data: mainTx.data as `0x${string}`,
        value: BigInt(mainTx.value),
      });

      hash = mainHash as string;
    }
  } else {
    // No approval needed, just send the main transaction
    const txHash = await signerClient.sendTransaction({
      account: senderAddress as `0x${string}`,
      to: mainTx.to as `0x${string}`,
      data: mainTx.data as `0x${string}`,
      value: BigInt(mainTx.value),
    });

    hash = txHash as string;
  }

  // Wait for confirmation
  if (isBatchTransaction) {
    // For batch transactions, poll for status
    let attempts = 0;
    const maxAttempts = 60; // 60 attempts * 2 seconds = 2 minutes max

    while (attempts < maxAttempts) {
      try {
        const status = await signerClient.request({
          method: 'wallet_getCallsStatus',
          params: [hash],
        });

        // Status codes: 100 = pending, 200 = confirmed, 300+ = failed
        if (status.status === 200 || status.status === 'CONFIRMED') {
          // Extract the actual transaction hash from receipts if available
          if (status.receipts && status.receipts.length > 0) {
            const mainTxHash =
              status.receipts[status.receipts.length - 1]?.transactionHash;
            if (mainTxHash) {
              return mainTxHash as `0x${string}`;
            }
          }
          return hash as `0x${string}`;
        } else if (status.status >= 300 || status.status === 'FAILED') {
          console.error('[executeDecentTransaction] Batch transaction failed');
          throw new Error('Batch transaction failed');
        }

        // Still pending, wait and try again
        await new Promise((resolve) => setTimeout(resolve, 2000));
        attempts++;
      } catch (error) {
        // If we can't check status, wait and try again
        await new Promise((resolve) => setTimeout(resolve, 2000));
        attempts++;
      }
    }

    // Polling timed out, assume success
    return hash as `0x${string}`;
  } else {
    // For regular transactions, wait for receipt
    await publicClient.waitForTransactionReceipt({
      hash: hash as `0x${string}`,
    });
    return hash as `0x${string}`;
  }
}

/**
 * Get an estimated quote for how much of the source token is needed
 * This calls the Decent API to get a quote without executing the transaction
 */
export async function getDecentQuote(
  senderAddress: `0x${string}`,
  srcToken: PaymentToken,
  reviewee: `0x${string}`,
  content: string,
  emoji: number,
  huntAmount: bigint
): Promise<{
  srcAmount: bigint;
  srcToken: TokenInfo;
}> {
  try {
    const txConfig = createReviewConfig(
      senderAddress,
      srcToken,
      reviewee,
      content,
      emoji,
      huntAmount
    );

    const result = await prepareDecentTransaction({ txConfig });

    if (!result.tokenPayment || !result.tokenPayment.amount) {
      console.error('[getDecentQuote] Invalid response structure:', result);
      throw new Error(
        `Invalid Decent API response for ${srcToken}: missing tokenPayment.amount`
      );
    }

    return {
      srcAmount: BigInt(result.tokenPayment.amount),
      srcToken: PAYMENT_TOKENS[srcToken],
    };
  } catch (error) {
    console.error('Failed to get Decent quote:', error);
    throw error;
  }
}

