import { cache } from "react";
import { NeynarUser } from "./neynar";

function mapNeynarUser(user: any): NeynarUser {
  return {
    fid: user.fid,
    username: user.username,
    displayName: user.display_name,
    pfp: { url: user.pfp_url },
    bio: user.profile?.bio?.text || "",
    followerCount: user.follower_count || 0,
    followingCount: user.following_count || 0,
    verifiedAddresses: {
      ethAddresses: user.verified_addresses?.eth_addresses || [],
      primary: {
        ethAddress: user.verified_addresses?.eth_addresses?.[0] || null,
      },
      custodyAddress: user.custody_address,
    },
  };
}

export const getProfilesByAddresses = cache(
  async (addresses: string[]): Promise<Record<string, NeynarUser | null>> => {
    if (addresses.length === 0) return {};

    try {
      const apiKey = process.env.NEYNAR_API_KEY;
      if (!apiKey) {
        console.error("NEYNAR_API_KEY is not configured");
        return {};
      }

      // Neynar API limits batch size, but we usually only fetch 1 or 2 here
      const uniqueAddresses = Array.from(
        new Set(addresses.map((a) => a.toLowerCase()))
      );
      const response = await fetch(
        `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${uniqueAddresses.join(
          ","
        )}`,
        {
          headers: {
            "x-api-key": apiKey,
            accept: "application/json",
          },
          next: { revalidate: 300 },
        }
      );

      if (!response.ok) {
        return {};
      }

      const data = await response.json();
      const result: Record<string, NeynarUser | null> = {};

      uniqueAddresses.forEach((addr) => {
        const userData = data[addr]; // Neynar returns object keyed by lowercase address
        if (userData && userData.length > 0) {
          result[addr] = mapNeynarUser(userData[0]);
        } else {
          result[addr] = null;
        }
      });

      return result;
    } catch (error) {
      console.error("Failed to fetch profiles:", error);
      return {};
    }
  }
);

export const getProfileByAddress = cache(
  async (address: string): Promise<NeynarUser | null> => {
    const profiles = await getProfilesByAddresses([address]);
    return profiles[address.toLowerCase()] || null;
  }
);
