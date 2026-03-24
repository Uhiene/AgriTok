import { useChainId, useSwitchChain, useAccount } from 'wagmi'
import { bscTestnet } from 'wagmi/chains'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, Loader2 } from 'lucide-react'

export default function WrongNetworkBanner() {
  const { isConnected }            = useAccount()
  const chainId                    = useChainId()
  const { switchChain, isPending } = useSwitchChain()

  const isWrongNetwork = isConnected && chainId !== bscTestnet.id

  return (
    <AnimatePresence>
      {isWrongNetwork && (
        <motion.div
          key="wrong-network"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0  }}
          exit={{    opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="w-full bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle size={14} className="text-amber-600 flex-shrink-0" strokeWidth={2} />
            <p className="font-body text-xs text-amber-800 truncate">
              Switch to <span className="font-semibold">BNB Chain Testnet</span> to use blockchain features
            </p>
          </div>
          <button
            onClick={() => switchChain({ chainId: bscTestnet.id })}
            disabled={isPending}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-amber-600 hover:bg-amber-700 text-white font-body text-xs font-semibold disabled:opacity-60 transition-colors"
          >
            {isPending && <Loader2 size={11} className="animate-spin" />}
            {isPending ? 'Switching...' : 'Switch Network'}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
