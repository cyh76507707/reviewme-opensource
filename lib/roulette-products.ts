/**
 * Curated list of products/services for Roulette
 * These are Farcaster accounts representing products, protocols, and services
 */

export interface RouletteProduct {
  fid: number;
  name: string;
  category: 'defi' | 'infra' | 'social' | 'nft' | 'wallet' | 'product' | 'other';
}

export const ROULETTE_PRODUCTS: RouletteProduct[] = [
  // Data & Analytics
  { fid: 252002, name: "coingecko", category: "infra" },
  { fid: 333312, name: "dune.eth", category: "infra" },
  { fid: 20909, name: "airstack.eth", category: "infra" },
  
  // Farcaster Infrastructure
  { fid: 6131, name: "neynar", category: "infra" },
  
  // Coinbase & Base Ecosystem
  { fid: 21773, name: "coinbase", category: "infra" },
  { fid: 12142, name: "base.base.eth", category: "infra" },
  { fid: 298035, name: "cbventures", category: "infra" },
  
  // DeFi Protocols
  { fid: 211205, name: "aerodrome", category: "defi" },
  { fid: 195960, name: "velodrome", category: "defi" },
  { fid: 1127612, name: "wasabiprotocol", category: "defi" },
  
  // L2 & Chains
  { fid: 300898, name: "optimism", category: "infra" },
  { fid: 536359, name: "arbitrum", category: "infra" },
  { fid: 282172, name: "monad", category: "infra" },
  { fid: 1316715, name: "gmonchain", category: "infra" },
  
  // Wallets
  { fid: 827605, name: "zapper", category: "wallet" },
  { fid: 20919, name: "rainbow", category: "wallet" },
  { fid: 3905, name: "zerion", category: "wallet" },
  { fid: 222464, name: "metamask", category: "wallet" },
  
  // NFT & Creative
  { fid: 20910, name: "zora", category: "nft" },
  { fid: 488436, name: "farcards", category: "nft" },
  
  // Social & Community
  { fid: 12312, name: "paragraph", category: "social" },
  { fid: 219631, name: "fwb", category: "social" },
  { fid: 20442, name: "talent", category: "social" },
  { fid: 1439819, name: "beeper", category: "social" },
  
  // Farcaster Apps & Games
  { fid: 562300, name: "mintclub", category: "product" },
  { fid: 702530, name: "hunttown.eth", category: "product" },
  { fid: 1132540, name: "ripsapp", category: "product" },
  { fid: 1047658, name: "betrmint", category: "product" },
  { fid: 867994, name: "betswirl", category: "product" },
  { fid: 1446240, name: "almoapp", category: "product" },
  { fid: 324420, name: "bracketgame", category: "product" },
  { fid: 325741, name: "farcade", category: "product" },
  { fid: 1046430, name: "inflynce", category: "product" },
  { fid: 18581, name: "ponder", category: "product" },
  { fid: 1058691, name: "noiceapp", category: "product" },
  { fid: 987581, name: "warpslot", category: "product" },
  { fid: 980410, name: "ampsfun", category: "product" },
  { fid: 874152, name: "thefirm", category: "product" },
  { fid: 294394, name: "intori", category: "product" },
  { fid: 352723, name: "retake", category: "product" },
  { fid: 1117286, name: "hashhorse", category: "product" },
  { fid: 1005896, name: "scanqrbase.eth", category: "product" },
  { fid: 490435, name: "farhouse", category: "product" },
  { fid: 1353274, name: "based-karma.eth", category: "product" },
  { fid: 1148720, name: "daehanbase.base.eth", category: "product" },
];

/**
 * Get random products from the curated list
 */
export function getRandomProducts(count: number = 3): RouletteProduct[] {
  const shuffled = [...ROULETTE_PRODUCTS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
