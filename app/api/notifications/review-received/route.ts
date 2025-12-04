import { NextRequest, NextResponse } from 'next/server';
import { notifyReviewReceived } from '@/lib/notification.server';
import { publicClient, REVIEWME_CONTRACT_ADDRESS } from '@/lib/reviewme-contract';
import { keccak256, toHex } from 'viem';

// ReviewSubmitted event signature
// event ReviewSubmitted(uint256 indexed reviewId, address indexed reviewer, address indexed reviewee, string content, uint8 emoji, uint256 timestamp)
const REVIEW_SUBMITTED_SIGNATURE = keccak256(
  toHex('ReviewSubmitted(uint256,address,address,string,uint8,uint256)')
);

export async function POST(request: NextRequest) {
  try {
    const { reviewId, revieweeFid, reviewerUsername, emoji, transactionHash } =
      await request.json();

    if (!transactionHash) {
      return NextResponse.json(
        { error: 'Transaction hash is required' },
        { status: 400 }
      );
    }

    // Verify transaction on-chain
    try {
      const tx = await publicClient.getTransactionReceipt({
        hash: transactionHash as `0x${string}`
      });

      if (tx.status !== 'success') {
        return NextResponse.json(
          { error: 'Transaction failed on-chain' },
          { status: 400 }
        );
      }

      // Verify the transaction interacted with our ReviewMe contract
      const reviewSubmittedEvent = tx.logs.find(
        (log) => 
          log.address.toLowerCase() === REVIEWME_CONTRACT_ADDRESS.toLowerCase() &&
          log.topics[0] === REVIEW_SUBMITTED_SIGNATURE
      );

      if (!reviewSubmittedEvent) {
        console.warn('Transaction did not emit ReviewSubmitted event');
        return NextResponse.json(
          { error: 'Invalid review transaction' },
          { status: 400 }
        );
      }

      // Optionally: Verify the reviewId from the event matches the provided reviewId
      // const eventReviewId = Number(reviewSubmittedEvent.topics[1]);
      // if (eventReviewId !== reviewId) {
      //   return NextResponse.json({ error: 'Review ID mismatch' }, { status: 400 });
      // }

    } catch (txError) {
      console.error('Transaction verification failed:', txError);
      return NextResponse.json(
        { error: 'Invalid transaction hash' },
        { status: 400 }
      );
    }

    const result = await notifyReviewReceived({
      reviewId,
      revieweeFid,
      reviewerUsername,
      emoji,
    });

    return NextResponse.json({
      success: true,
      notified: result.notified,
    });
  } catch (error) {
    console.error('Failed to send notification:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}

