import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory rate limiter (resets every minute)
let requestCount = 0
let lastResetTime = Date.now()
const MAX_REQUESTS_PER_MINUTE = 30 // Conservative limit to avoid 429 errors

function checkRateLimit(): boolean {
  const now = Date.now()
  // Reset counter every minute
  if (now - lastResetTime > 60 * 1000) {
    requestCount = 0
    lastResetTime = now
  }
  
  if (requestCount >= MAX_REQUESTS_PER_MINUTE) {
    return false // Rate limit exceeded
  }
  
  requestCount++
  return true
}

/**
 * Batch fetch Farcaster profiles by FIDs (GET)
 * Usage: /api/neynar/user/batch?fids=1,2,3
 */
export async function GET(request: NextRequest) {
  try {
    if (!checkRateLimit()) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', users: [] },
        { status: 429 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const fidsParam = searchParams.get('fids')

    if (!fidsParam) {
      return NextResponse.json(
        { error: 'fids parameter is required' },
        { status: 400 }
      )
    }

    const fids = fidsParam.split(',').filter(Boolean)
    if (fids.length === 0) {
      return NextResponse.json({ users: [] })
    }

    const apiKey = process.env.NEYNAR_API_KEY
    if (!apiKey) {
      throw new Error('NEYNAR_API_KEY is not configured')
    }

    // Use bulk FIDs API
    const url = `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fids.join(',')}`

    const response = await fetch(url, {
      headers: {
        'x-api-key': apiKey,
        'accept': 'application/json'
      }
    })

    if (!response.ok) {
      console.error('Neynar API error:', response.status)
      return NextResponse.json({ users: [] })
    }

    const data = await response.json()
    
    // Normalize the response
    const users = (data.users || []).map((user: any) => ({
      fid: user.fid,
      username: user.username,
      display_name: user.display_name,
      displayName: user.display_name,
      pfp_url: user.pfp_url,
      pfp: { url: user.pfp_url },
      follower_count: user.follower_count,
      followerCount: user.follower_count,
      bio: user.profile?.bio?.text || '',
      profile: user.profile,
    }))

    return NextResponse.json({ users })
  } catch (error: any) {
    console.error('Batch FIDs API error:', error)
    return NextResponse.json(
      { error: error.message, users: [] },
      { status: 500 }
    )
  }
}

/**
 * Batch fetch Farcaster profiles by wallet addresses (POST)
 * Accepts up to 50 addresses at once to avoid rate limits
 */
export async function POST(request: NextRequest) {
  try {
    // Check rate limit
    if (!checkRateLimit()) {
      console.warn('Rate limit exceeded for Neynar batch API')
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again in a moment.', profiles: {} },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { addresses } = body

    if (!addresses || !Array.isArray(addresses)) {
      return NextResponse.json(
        { error: 'addresses array is required' },
        { status: 400 }
      )
    }

    if (addresses.length === 0) {
      return NextResponse.json({ profiles: {} })
    }

    if (addresses.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 addresses per batch' },
        { status: 400 }
      )
    }

    const apiKey = process.env.NEYNAR_API_KEY
    if (!apiKey) {
      throw new Error('NEYNAR_API_KEY is not configured')
    }

    // Use bulk-by-address API to fetch all profiles in one call
    const uniqueAddresses = [...new Set(addresses.map((addr: string) => addr.toLowerCase()))]
    const url = `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${uniqueAddresses.join(',')}`

    let data: any = {}
    
    try {
      const response = await fetch(url, {
        headers: {
          'x-api-key': apiKey,
          'accept': 'application/json'
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Neynar API error:', response.status, errorText)
        
        // Handle 429 rate limit specifically
        if (response.status === 429) {
          return NextResponse.json(
            { error: 'Neynar API rate limit exceeded. Please try again in a moment.', profiles: {} },
            { status: 429 }
          )
        }
        
        // Return empty profiles object instead of throwing
        // This allows the page to load even if API fails
        return NextResponse.json({ profiles: {} })
      }

      data = await response.json()
    } catch (error: any) {
      console.error('Failed to fetch from Neynar API:', error)
      // Return empty profiles object instead of throwing
      return NextResponse.json({ profiles: {} })
    }

    // Normalize response: { [address]: [users] } -> { [address]: user }
    const profiles: Record<string, any> = {}
    
    try {
      for (const address of uniqueAddresses) {
        try {
          const addressData = data[address.toLowerCase()]
          if (addressData && addressData.length > 0) {
            const user = addressData[0] // Use primary account
            profiles[address.toLowerCase()] = {
              fid: user.fid,
              username: user.username,
              displayName: user.display_name,
              pfp: { url: user.pfp_url },
              bio: user.profile?.bio?.text || '',
              followerCount: user.follower_count || 0,
              followingCount: user.following_count || 0,
              verifiedAddresses: {
                ethAddresses: user.verified_addresses?.eth_addresses || [],
                primary: {
                  ethAddress: user.verified_addresses?.primary?.eth_address || null
                }
              }
            }
          }
        } catch (err) {
          // Skip this address if parsing fails, continue with others
          console.error(`Failed to parse profile for ${address}:`, err)
        }
      }
    } catch (error) {
      console.error('Error processing profiles:', error)
      // Return whatever profiles we managed to parse
    }

    return NextResponse.json({ profiles })
  } catch (error: any) {
    console.error('Batch Neynar API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch user data', profiles: {} },
      { status: 500 }
    )
  }
}

