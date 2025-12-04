'use client'

/**
 * WalletAvatar Component
 * 
 * Generates a deterministic avatar for wallet addresses
 * Based on RainbowKit's avatar system
 * 
 * Reference: https://rainbowkit.com/docs/custom-avatars
 */

interface WalletAvatarProps {
  address: string
  size?: number
  className?: string
}

// Generate a color from address (deterministic)
function generateColorFromAddress(address: string): string {
  const colors = [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#FFA07A', // Light Salmon
    '#98D8C8', // Mint
    '#F7DC6F', // Yellow
    '#BB8FCE', // Purple
    '#85C1E2', // Sky Blue
    '#F8B88B', // Peach
    '#52B788', // Green
  ]
  
  // Use address to deterministically select a color
  const hash = address.toLowerCase().split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc)
  }, 0)
  
  return colors[Math.abs(hash) % colors.length]
}

// Generate initials from address
function getAddressInitials(address: string): string {
  if (!address) return '??'
  // Take first and last character after 0x
  const cleaned = address.replace('0x', '')
  return `${cleaned[0]}${cleaned[cleaned.length - 1]}`.toUpperCase()
}

export function WalletAvatar({ address, size = 40, className = '' }: WalletAvatarProps) {
  const color = generateColorFromAddress(address)
  const initials = getAddressInitials(address)
  
  return (
    <div
      className={`flex items-center justify-center rounded-full font-semibold text-white ${className}`}
      style={{
        backgroundColor: color,
        width: size,
        height: size,
        fontSize: size * 0.4,
      }}
    >
      {initials}
    </div>
  )
}

// Utility function to format address
export function formatAddress(address: string): string {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

