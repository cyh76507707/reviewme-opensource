/**
 * Client-side caching system for ReviewMe
 * Uses IndexedDB for large data (reviews) and localStorage for small data (txHash, profiles)
 */

// Cache TTL constants
const CACHE_TTL = {
  REVIEW: 24 * 60 * 60 * 1000, // 24 hours (reviews never change)
  TX_HASH: Infinity, // Never expires (txHash never changes)
  PROFILE: 60 * 60 * 1000, // 1 hour (profiles can change)
} as const;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

// ==================== IndexedDB (for large data) ====================

const DB_NAME = 'reviewme-cache';
const DB_VERSION = 4; // Incremented to force cache reset
const REVIEW_STORE = 'reviews';
const PROFILE_STORE = 'profiles';
const REVIEWS_FOR_WALLET_STORE = 'reviewsForWallet';

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('IndexedDB not available in server environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = event.oldVersion;
      
      // Force cache reset: delete all existing stores and recreate
      if (oldVersion < DB_VERSION) {
        // Delete all existing stores
        if (db.objectStoreNames.contains(REVIEW_STORE)) {
          db.deleteObjectStore(REVIEW_STORE);
        }
        if (db.objectStoreNames.contains(RECENT_REVIEWS_STORE)) {
          db.deleteObjectStore(RECENT_REVIEWS_STORE);
        }
        if (db.objectStoreNames.contains(PROFILE_STORE)) {
          db.deleteObjectStore(PROFILE_STORE);
        }
        if (db.objectStoreNames.contains(REVIEWS_FOR_WALLET_STORE)) {
          db.deleteObjectStore(REVIEWS_FOR_WALLET_STORE);
        }
        
        // Clear localStorage txHash entries
        if (typeof window !== 'undefined') {
          const keys = Object.keys(localStorage);
          for (const key of keys) {
            if (key.startsWith('reviewme:txhash:')) {
              localStorage.removeItem(key);
            }
          }
        }
      }
      
      // Recreate all stores
      if (!db.objectStoreNames.contains(REVIEW_STORE)) {
        db.createObjectStore(REVIEW_STORE, { keyPath: 'reviewId' });
      }
      if (!db.objectStoreNames.contains(RECENT_REVIEWS_STORE)) {
        db.createObjectStore(RECENT_REVIEWS_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(PROFILE_STORE)) {
        db.createObjectStore(PROFILE_STORE, { keyPath: 'address' });
      }
      if (!db.objectStoreNames.contains(REVIEWS_FOR_WALLET_STORE)) {
        db.createObjectStore(REVIEWS_FOR_WALLET_STORE, { keyPath: 'wallet' });
      }
    };
  });

  return dbPromise;
}

// ==================== Review Cache (IndexedDB) ====================

export interface CachedReview {
  reviewId: number;
  reviewer: `0x${string}`;
  reviewee: `0x${string}`;
  content: string;
  emoji: number;
  timestamp: string; // BigInt serialized as string
}

export async function getCachedReview(reviewId: number): Promise<CachedReview | null> {
  if (typeof window === 'undefined') return null;

  try {
    const db = await getDB();
    const transaction = db.transaction([REVIEW_STORE], 'readonly');
    const store = transaction.objectStore(REVIEW_STORE);
    const request = store.get(reviewId);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const entry = request.result as CacheEntry<CachedReview> | undefined;
        if (!entry) {
          resolve(null);
          return;
        }

        // Check expiration
        if (Date.now() > entry.expiresAt) {
          // Expired, delete and return null
          deleteCachedReview(reviewId).catch(console.error);
          resolve(null);
          return;
        }

        resolve(entry.data);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to get cached review:', error);
    return null;
  }
}

export async function setCachedReview(reviewId: number, review: CachedReview): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const db = await getDB();
    const transaction = db.transaction([REVIEW_STORE], 'readwrite');
    const store = transaction.objectStore(REVIEW_STORE);

    const entry: CacheEntry<CachedReview> = {
      data: review,
      timestamp: Date.now(),
      expiresAt: Date.now() + CACHE_TTL.REVIEW,
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put({ reviewId, ...entry });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to cache review:', error);
  }
}

export async function deleteCachedReview(reviewId: number): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const db = await getDB();
    const transaction = db.transaction([REVIEW_STORE], 'readwrite');
    const store = transaction.objectStore(REVIEW_STORE);
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(reviewId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to delete cached review:', error);
  }
}

// ==================== TxHash Cache (localStorage) ====================

const TX_HASH_KEY_PREFIX = 'reviewme:txhash:';

export function getCachedTxHash(reviewId: number): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const key = `${TX_HASH_KEY_PREFIX}${reviewId}`;
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const entry: CacheEntry<string> = JSON.parse(cached);

    // Check expiration (should never expire, but check anyway)
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(key);
      return null;
    }

    return entry.data;
  } catch (error) {
    console.error('Failed to get cached txHash:', error);
    return null;
  }
}

export function setCachedTxHash(reviewId: number, txHash: string): void {
  if (typeof window === 'undefined') return;

  try {
    const key = `${TX_HASH_KEY_PREFIX}${reviewId}`;
    const entry: CacheEntry<string> = {
      data: txHash,
      timestamp: Date.now(),
      expiresAt: Date.now() + CACHE_TTL.TX_HASH,
    };

    localStorage.setItem(key, JSON.stringify(entry));
  } catch (error) {
    console.error('Failed to cache txHash:', error);
  }
}

// ==================== Recent Reviews Cache (IndexedDB) ====================

const RECENT_REVIEWS_STORE = 'recentReviews';

export interface CachedRecentReviews {
  offset: number;
  limit: number;
  reviews: CachedReview[];
  timestamp: number;
}

const RECENT_REVIEWS_TTL = 60 * 1000; // 1 minute (recent reviews can change)

export async function getCachedRecentReviews(
  offset: number,
  limit: number
): Promise<CachedReview[] | null> {
  if (typeof window === 'undefined') return null;

  try {
    const db = await getDB();
    const transaction = db.transaction([RECENT_REVIEWS_STORE], 'readonly');
    const store = transaction.objectStore(RECENT_REVIEWS_STORE);
    const key = `${offset}-${limit}`;
    const request = store.get(key);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const entry = request.result as CacheEntry<CachedRecentReviews> | undefined;
        if (!entry) {
          resolve(null);
          return;
        }

        // Check expiration
        if (Date.now() > entry.expiresAt) {
          deleteCachedRecentReviews(offset, limit).catch(console.error);
          resolve(null);
          return;
        }

        resolve(entry.data.reviews);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to get cached recent reviews:', error);
    return null;
  }
}

export async function setCachedRecentReviews(
  offset: number,
  limit: number,
  reviews: CachedReview[]
): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const db = await getDB();
    const transaction = db.transaction([RECENT_REVIEWS_STORE], 'readwrite');
    const store = transaction.objectStore(RECENT_REVIEWS_STORE);

    const entry: CacheEntry<CachedRecentReviews> = {
      data: {
        offset,
        limit,
        reviews,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
      expiresAt: Date.now() + RECENT_REVIEWS_TTL,
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put({ key: `${offset}-${limit}`, ...entry });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to cache recent reviews:', error);
  }
}

async function deleteCachedRecentReviews(offset: number, limit: number): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const db = await getDB();
    const transaction = db.transaction([RECENT_REVIEWS_STORE], 'readwrite');
    const store = transaction.objectStore(RECENT_REVIEWS_STORE);
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(`${offset}-${limit}`);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to delete cached recent reviews:', error);
  }
}

// ==================== Reviews For Wallet Cache (IndexedDB) ====================

const REVIEWS_FOR_WALLET_TTL = 5 * 60 * 1000; // 5 minutes

export async function getCachedReviewsForWallet(wallet: string): Promise<CachedReview[] | null> {
  if (typeof window === 'undefined') return null;

  try {
    const db = await getDB();
    const transaction = db.transaction([REVIEWS_FOR_WALLET_STORE], 'readonly');
    const store = transaction.objectStore(REVIEWS_FOR_WALLET_STORE);
    const normalizedWallet = wallet.toLowerCase();
    const request = store.get(normalizedWallet);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const entry = request.result as CacheEntry<CachedReview[]> | undefined;
        if (!entry) {
          resolve(null);
          return;
        }

        // Check expiration
        if (Date.now() > entry.expiresAt) {
          deleteCachedReviewsForWallet(normalizedWallet).catch(console.error);
          resolve(null);
          return;
        }

        resolve(entry.data);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to get cached reviews for wallet:', error);
    return null;
  }
}

export async function setCachedReviewsForWallet(wallet: string, reviews: CachedReview[]): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const db = await getDB();
    const transaction = db.transaction([REVIEWS_FOR_WALLET_STORE], 'readwrite');
    const store = transaction.objectStore(REVIEWS_FOR_WALLET_STORE);
    const normalizedWallet = wallet.toLowerCase();

    const entry: CacheEntry<CachedReview[]> = {
      data: reviews,
      timestamp: Date.now(),
      expiresAt: Date.now() + REVIEWS_FOR_WALLET_TTL,
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put({ wallet: normalizedWallet, ...entry });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to cache reviews for wallet:', error);
  }
}

async function deleteCachedReviewsForWallet(wallet: string): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const db = await getDB();
    const transaction = db.transaction([REVIEWS_FOR_WALLET_STORE], 'readwrite');
    const store = transaction.objectStore(REVIEWS_FOR_WALLET_STORE);
    const normalizedWallet = wallet.toLowerCase();
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(normalizedWallet);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to delete cached reviews for wallet:', error);
  }
}

// ==================== Profile Cache (IndexedDB) ====================

export interface CachedProfile {
  address: string; // Lowercase address as key
  fid: number;
  username: string;
  displayName: string;
  pfp: { url: string };
  bio: string;
  followerCount: number;
  followingCount: number;
  verifiedAddresses: {
    ethAddresses: string[];
  };
}

export async function getCachedProfile(address: string): Promise<CachedProfile | null | undefined> {
  if (typeof window === 'undefined') return undefined;

  try {
    const db = await getDB();
    const transaction = db.transaction([PROFILE_STORE], 'readonly');
    const store = transaction.objectStore(PROFILE_STORE);
    const normalizedAddress = address.toLowerCase();
    const request = store.get(normalizedAddress);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const entry = request.result as CacheEntry<CachedProfile | null> | undefined;
        if (!entry) {
          // Not in cache at all
          resolve(undefined);
          return;
        }

        // Check expiration
        if (Date.now() > entry.expiresAt) {
          // Expired, delete and return undefined
          deleteCachedProfile(normalizedAddress).catch(console.error);
          resolve(undefined);
          return;
        }

        // Return cached data (could be null for users without Farcaster)
        resolve(entry.data);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to get cached profile:', error);
    return undefined;
  }
}

export async function getCachedProfiles(addresses: string[]): Promise<Record<string, CachedProfile | null | undefined>> {
  if (typeof window === 'undefined') return {};

  const result: Record<string, CachedProfile | null | undefined> = {};

  try {
    const db = await getDB();
    const transaction = db.transaction([PROFILE_STORE], 'readonly');
    const store = transaction.objectStore(PROFILE_STORE);

    // Fetch all profiles in parallel
    const promises = addresses.map(address => {
      const normalizedAddress = address.toLowerCase();
      return new Promise<void>((resolve) => {
        const request = store.get(normalizedAddress);
        request.onsuccess = () => {
          const entry = request.result as CacheEntry<CachedProfile | null> | undefined;
          if (entry && Date.now() <= entry.expiresAt) {
            // Found valid cached profile (could be null for users without Farcaster)
            result[normalizedAddress] = entry.data;
          } else if (entry) {
            // Expired, delete
            deleteCachedProfile(normalizedAddress).catch(console.error);
            result[normalizedAddress] = undefined; // Mark as not cached
          } else {
            // Not in cache at all
            result[normalizedAddress] = undefined;
          }
          resolve();
        };
        request.onerror = () => {
          result[normalizedAddress] = undefined; // Mark as not cached on error
          resolve();
        };
      });
    });

    await Promise.all(promises);
  } catch (error) {
    console.error('Failed to get cached profiles:', error);
  }

  return result;
}

export async function setCachedProfile(address: string, profile: CachedProfile | null): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const db = await getDB();
    const transaction = db.transaction([PROFILE_STORE], 'readwrite');
    const store = transaction.objectStore(PROFILE_STORE);
    const normalizedAddress = address.toLowerCase();

    if (profile === null) {
      // Cache null to avoid repeated API calls for users without Farcaster
      // Store a special marker with null data but valid expiry
      const entry: CacheEntry<CachedProfile | null> = {
        data: null,
        timestamp: Date.now(),
        expiresAt: Date.now() + CACHE_TTL.PROFILE,
      };

      await new Promise<void>((resolve, reject) => {
        const request = store.put({ address: normalizedAddress, ...entry });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      return;
    }

    const entry: CacheEntry<CachedProfile> = {
      data: {
        ...profile,
        address: normalizedAddress,
      },
      timestamp: Date.now(),
      expiresAt: Date.now() + CACHE_TTL.PROFILE,
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put({ address: normalizedAddress, ...entry });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to cache profile:', error);
  }
}

export async function setCachedProfiles(profiles: Record<string, CachedProfile | null>): Promise<void> {
  if (typeof window === 'undefined') return;

  // Set all profiles in parallel
  const promises = Object.entries(profiles).map(([address, profile]) =>
    setCachedProfile(address, profile)
  );

  await Promise.all(promises);
}

async function deleteCachedProfile(address: string): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const db = await getDB();
    const transaction = db.transaction([PROFILE_STORE], 'readwrite');
    const store = transaction.objectStore(PROFILE_STORE);
    const normalizedAddress = address.toLowerCase();
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(normalizedAddress);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to delete cached profile:', error);
  }
}

// ==================== Cache Management ====================

export async function clearAllCache(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    // Clear IndexedDB
    const db = await getDB();
    const stores = [REVIEW_STORE, RECENT_REVIEWS_STORE, PROFILE_STORE, REVIEWS_FOR_WALLET_STORE];

    for (const storeName of stores) {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    // Clear localStorage txHash entries
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith(TX_HASH_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
}

/**
 * Clean old cache entries (Garbage Collection)
 * Deletes entries older than 7 days (except txHash which is immutable)
 * Should be called on app initialization
 */
export async function cleanOldCache(): Promise<void> {
  if (typeof window === 'undefined') return;

  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  try {
    const db = await getDB();
    const stores = [REVIEW_STORE, RECENT_REVIEWS_STORE, PROFILE_STORE, REVIEWS_FOR_WALLET_STORE];

    for (const storeName of stores) {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
        if (cursor) {
          const entry = cursor.value as CacheEntry<any>;
          // Delete if older than 7 days OR if expired
          if ((now - entry.timestamp > SEVEN_DAYS_MS) || (now > entry.expiresAt)) {
            cursor.delete();
          }
          cursor.continue();
        }
      };
    }

    console.log('[Cache] 🧹 Garbage collection completed');
  } catch (error) {
    console.error('Failed to clean old cache:', error);
  }
}

