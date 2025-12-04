import { Metadata } from "next";
import UserProfilePageContent from "@/components/UserProfilePageContent";
import { constructMetadata } from "@/lib/metadata";
import { getProfileByAddress } from "@/lib/neynar-server";
import { getReviewCount } from "@/lib/reviewme-contract";
import { formatAddress } from "@/lib/neynar";

interface Props {
  params: { address: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const address = params.address;

  // Parallel fetch profile and review count
  // We don't want metadata generation to fail, so we catch errors
  const [profile, reviewCount] = await Promise.all([
    getProfileByAddress(address),
    getReviewCount(address as `0x${string}`).catch(() => 0),
  ]);

  const displayName = profile?.displayName || formatAddress(address);
  // Limit bio length for description
  const bio = profile?.bio
    ? ` - ${profile.bio.substring(0, 100)}${
        profile.bio.length > 100 ? "..." : ""
      }`
    : "";
  const reviewsText =
    reviewCount > 0
      ? `${reviewCount} review${reviewCount === 1 ? "" : "s"}`
      : "No reviews yet";

  return constructMetadata({
    title: `${displayName} (${reviewsText})`,
    description: `Check out onchain reviews for ${displayName}${bio}. ${reviewsText} on ReviewMe.`,
    path: `/user/${address}`,
    imageUrl: profile?.pfp?.url,
    frameButtonTitle: `Review ${displayName}`,
  });
}

export default function UserPage({ params }: Props) {
  return <UserProfilePageContent address={params.address} />;
}
