'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ExternalLink, Heart, Repeat2 } from 'lucide-react'
import Link from 'next/link'

interface CastData {
  hash: string
  author: {
    fid: number
    username: string
    displayName: string
    profileImage: string
  }
  text: string
  timestamp: string
  reactions: {
    likes: number
    recasts: number
  }
}

interface CastPreviewProps {
  castUrl: string
}

export function CastPreview({ castUrl }: CastPreviewProps) {
  const [cast, setCast] = useState<CastData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadCast()
  }, [castUrl])

  const loadCast = async () => {
    try {
      const response = await fetch(`/api/neynar/cast?url=${encodeURIComponent(castUrl)}`)
      
      if (!response.ok) {
        throw new Error('Failed to load cast')
      }

      const data = await response.json()
      setCast(data)
    } catch (err: any) {
      console.error('Failed to load cast:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="animate-pulse space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-200" />
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/4" />
              </div>
            </div>
            <div className="h-16 bg-gray-200 rounded" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !cast) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 mb-2">Failed to load cast</p>
            <Link
              href={castUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-600 hover:underline text-sm inline-flex items-center gap-1"
            >
              View on Farcaster
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-6">
        {/* Author */}
        <div className="flex items-center gap-3 mb-3">
          <img
            src={cast.author.profileImage}
            alt={cast.author.displayName}
            className="w-10 h-10 rounded-full"
          />
          <div className="flex-1">
            <p className="font-semibold text-sm">{cast.author.displayName}</p>
            <p className="text-xs text-gray-500">@{cast.author.username}</p>
          </div>
          <Link
            href={castUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-gray-600"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>

        {/* Text */}
        <p className="text-sm text-gray-800 mb-3 whitespace-pre-wrap">
          {cast.text}
        </p>

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Heart className="h-3 w-3" />
            <span>{cast.reactions.likes}</span>
          </div>
          <div className="flex items-center gap-1">
            <Repeat2 className="h-3 w-3" />
            <span>{cast.reactions.recasts}</span>
          </div>
          <div className="ml-auto">
            {new Date(cast.timestamp).toLocaleDateString()}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

