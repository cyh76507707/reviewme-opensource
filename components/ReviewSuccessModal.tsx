'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle, Sparkles } from 'lucide-react'
import { Button } from './ui/button'

interface ReviewSuccessModalProps {
  isOpen: boolean
  onClose: () => void
  data: {
    totalMinted: number
    reviewerReceived: number
    creatorReceived: number
    royalty: number
    huntCost: string
    creatorName: string
  }
}

export function ReviewSuccessModal({ isOpen, onClose, data }: ReviewSuccessModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-purple-900/30 rounded-2xl p-6 max-w-md w-full border border-pink-500/30 shadow-2xl shadow-pink-500/20 relative overflow-hidden">
              {/* Sparkle effect */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl" />
              
              {/* Content */}
              <div className="relative z-10">
                {/* Close button */}
                <button
                  onClick={onClose}
                  className="absolute top-0 right-0 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                
                {/* Success icon */}
                <div className="flex justify-center mb-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                    className="relative"
                  >
                    <CheckCircle className="w-16 h-16 text-green-400" />
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: [0, 1.2, 1], opacity: [0, 1, 0] }}
                      transition={{ delay: 0.3, duration: 0.6 }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <Sparkles className="w-20 h-20 text-pink-400" />
                    </motion.div>
                  </motion.div>
                </div>
                
                {/* Title */}
                <h2 className="text-2xl font-bold text-white text-center mb-2">
                  Review Submitted!
                </h2>
                <p className="text-gray-400 text-center text-sm mb-6">
                  Your review is now on-chain ✨
                </p>
                
                {/* Stats */}
                <div className="space-y-3 mb-6">
                  {/* Total Minted */}
                  <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700/50">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">Total Minted</span>
                      <span className="text-white font-bold">{data.totalMinted} tokens</span>
                    </div>
                  </div>
                  
                  {/* Distribution */}
                  <div className="bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-xl p-3 border border-pink-500/30">
                    <p className="text-xs text-gray-400 mb-2">Token Distribution:</p>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-300">You received</span>
                        <span className="text-white font-semibold">{data.reviewerReceived} tokens</span>
                      </div>
                      {data.creatorReceived > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-pink-300 flex items-center gap-1">
                            💝 Donated to {data.creatorName}
                          </span>
                          <span className="text-pink-400 font-semibold">{data.creatorReceived} tokens</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Creator royalty (1%)</span>
                        <span className="text-gray-400 font-medium">{data.royalty} tokens</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Cost */}
                  <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700/50">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">Total Cost</span>
                      <span className="text-white font-bold">{data.huntCost} HUNT</span>
                    </div>
                  </div>
                </div>
                
                {/* Close button */}
                <Button
                  onClick={onClose}
                  className="w-full bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white rounded-xl h-12 shadow-lg shadow-pink-500/25"
                >
                  Awesome!
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

