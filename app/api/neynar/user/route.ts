import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const username = searchParams.get('username')
  const fid = searchParams.get('fid')
  const address = searchParams.get('address')

  if (!username && !fid && !address) {
    return NextResponse.json(
      { error: 'Either username, fid, or address is required' },
      { status: 400 }
    )
  }

  try {
    const apiKey = process.env.NEYNAR_API_KEY
    if (!apiKey) {
      throw new Error('NEYNAR_API_KEY is not configured')
    }

    let url: string
    if (address) {
      // Get FID from wallet address using Bulk Users by Address API
      url = `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${address}`
    } else if (username) {
      // Convert username to lowercase for case-insensitive search
      url = `https://api.neynar.com/v2/farcaster/user/by_username?username=${username.toLowerCase()}`
    } else {
      url = `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`
    }

    const response = await fetch(url, {
      headers: {
        'x-api-key': apiKey,
        'accept': 'application/json'
      }
    })

    if (!response.ok) {
      // Return 404 for not found users instead of 500
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'No FID found for this wallet address' },
          { status: 404 }
        )
      }
      throw new Error(`Neynar API error: ${response.status}`)
    }

    const data = await response.json()
    
    // Normalize response based on endpoint
    let user
    if (address) {
      // bulk-by-address returns { [address]: [users] }
      const addressData = data[address.toLowerCase()]
      if (!addressData || addressData.length === 0) {
        return NextResponse.json(
          { error: 'No FID found for this wallet address' },
          { status: 404 }
        )
      }
      // Use the first user (primary account)
      user = addressData[0]
    } else if (username) {
      user = data.user
    } else {
      user = data.users[0]
    }
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
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
        },
        custodyAddress: user.custody_address || null
      }
    })
  } catch (error: any) {
    console.error('Neynar API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch user data' },
      { status: 500 }
    )
  }
}

