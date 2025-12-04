import { NextRequest, NextResponse } from 'next/server'

/**
 * Get a user's following list
 * Usage: /api/neynar/following?fid=123
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const fid = searchParams.get('fid')

    if (!fid) {
      return NextResponse.json(
        { error: 'fid parameter is required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.NEYNAR_API_KEY
    if (!apiKey) {
      throw new Error('NEYNAR_API_KEY is not configured')
    }

    // Get people you follow (limit 100 is Neynar max per docs)
    const followingUrl = `https://api.neynar.com/v2/farcaster/following?fid=${fid}&limit=100`
    console.log('Fetching following from:', followingUrl)
    
    const followingRes = await fetch(followingUrl, {
      headers: {
        'x-api-key': apiKey,
        'accept': 'application/json'
      }
    })

    if (!followingRes.ok) {
      const errorText = await followingRes.text()
      console.error('Neynar following API error:', followingRes.status, errorText)
      return NextResponse.json({ users: [], error: `API error: ${followingRes.status}` })
    }

    const followingData = await followingRes.json()
    console.log('Raw Neynar response keys:', Object.keys(followingData))
    console.log('Raw users array length:', followingData.users?.length || 0)
    
    // Neynar following endpoint returns { users: [{ object: "follower", user: {...} }, ...] }
    // Each item has the actual user nested under the "user" property
    const followingRaw = followingData.users || []
    
    // Debug: log first item structure
    if (followingRaw.length > 0) {
      console.log('First item structure:', JSON.stringify(followingRaw[0], null, 2).slice(0, 500))
    }
    
    const following = followingRaw.map((f: any) => f.user || f)
    
    console.log('Following count after extraction:', following.length)

    // Normalize the response
    const normalizedUsers = following.map((user: any) => ({
      fid: user.fid,
      username: user.username,
      displayName: user.display_name,
      pfpUrl: user.pfp_url,
      followerCount: user.follower_count,
      bio: user.profile?.bio?.text || '',
    }))

    return NextResponse.json({ users: normalizedUsers })
  } catch (error: any) {
    console.error('Following API error:', error)
    return NextResponse.json(
      { error: error.message, users: [] },
      { status: 500 }
    )
  }
}

