import { useWaitForTransactionReceipt, useBlockNumber } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Loader2, ExternalLink, AlertCircle, X } from 'lucide-react'
import type { TxStatus } from '../../hooks/useContractInteraction'

const BSCSCAN = 'https://testnet.bscscan.com/tx/'
const TARGET_CONFIRMATIONS = 1

interface Props {
  status:   TxStatus
  txHash?:  `0x${string}`
  errorMsg?: string | null
  onClose?: () => void
}

// Confirmation progress bar — uses live block number for accurate count
function ConfirmationBar({ txHash }: { txHash: `0x${string}` }) {
  const { data: receipt } = useWaitForTransactionReceipt({ hash: txHash, confirmations: 1 })
  const { data: currentBlock } = useBlockNumber({
    watch:   !!receipt,
    query:   { enabled: !!receipt },
  })

  const confirms = receipt && currentBlock
    ? Math.min(TARGET_CONFIRMATIONS, Number(currentBlock - receipt.blockNumber) + 1)
    : 0
  const pct = (confirms / TARGET_CONFIRMATIONS) * 100

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="font-body text-xs text-text-muted">Block confirmations</span>
        <span className="font-mono text-xs font-semibold text-forest-dark">
          {confirms} / {TARGET_CONFIRMATIONS}
        </span>
      </div>
      <div className="h-1.5 w-full bg-forest-dark/[0.07] rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-accent-green rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
      <div className="flex justify-between">
        {Array.from({ length: TARGET_CONFIRMATIONS }, (_, i) => (
          <div
            key={i}
            className={`flex flex-col items-center gap-1`}
            style={{ width: `${100 / TARGET_CONFIRMATIONS}%` }}
          >
            <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all duration-300 ${
              confirms > i ? 'bg-accent-green' : 'bg-forest-dark/10'
            }`}>
              {confirms > i && <CheckCircle2 size={10} strokeWidth={2.5} className="text-forest-dark" />}
            </div>
            <span className="font-body text-[9px] text-text-muted">Block {i + 1}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Step row in the progress list
function Step({
  label, active, done, error,
}: {
  label: string; active: boolean; done: boolean; error?: boolean
}) {
  return (
    <div className={`flex items-center gap-3 py-2 transition-opacity duration-300 ${
      !done && !active ? 'opacity-40' : ''
    }`}>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
        error   ? 'bg-red-100'
        : done  ? 'bg-accent-green/15'
        : active ? 'bg-blue-100'
        : 'bg-forest-dark/[0.06]'
      }`}>
        {error   ? <AlertCircle size={11} className="text-red-500" strokeWidth={2.5} />
        : done   ? <CheckCircle2 size={11} className="text-accent-green" strokeWidth={2.5} />
        : active ? <Loader2 size={11} className="text-blue-500 animate-spin" strokeWidth={2.5} />
        : <div className="w-1.5 h-1.5 rounded-full bg-forest-dark/20" />}
      </div>
      <span className={`font-body text-xs ${
        error   ? 'text-red-500 font-medium'
        : active ? 'text-forest-dark font-semibold'
        : done   ? 'text-text-muted line-through'
        : 'text-text-muted'
      }`}>
        {label}
      </span>
    </div>
  )
}

export default function TransactionStatus({ status, txHash, errorMsg, onClose }: Props) {
  if (status === 'idle' || status === 'done') return null

  // After the guard above, TypeScript narrows status to exclude 'idle' and 'done'
  const s        = status as TxStatus
  const isError  = s === 'error'

  return (
    <AnimatePresence>
      <motion.div
        key="tx-status"
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0,  scale: 1     }}
        exit={{    opacity: 0, y: 8,  scale: 0.97  }}
        transition={{ duration: 0.2 }}
        className="bg-white border border-[rgba(13,43,30,0.10)] rounded-card shadow-card p-5 space-y-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="font-body text-sm font-semibold text-forest-dark">
            {isError ? 'Transaction Failed' : 'BNB Chain Transaction'}
          </p>
          {isError && onClose && (
            <button
              onClick={onClose}
              className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-forest-dark/[0.06] text-text-muted hover:text-forest-dark transition-colors"
            >
              <X size={13} strokeWidth={2.5} />
            </button>
          )}
        </div>

        {/* Error state */}
        {isError && errorMsg && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-card">
            <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" strokeWidth={2} />
            <p className="font-body text-xs text-red-700">{errorMsg}</p>
          </div>
        )}

        {/* Step progress */}
        {!isError && (
          <div className="divide-y divide-[rgba(13,43,30,0.06)]">
            <Step
              label="Awaiting wallet confirmation"
              active={status === 'wallet'}
              done={['submitted', 'confirmed', 'saving'].includes(status)}
            />
            <Step
              label="Transaction submitted to BNB Chain"
              active={status === 'submitted'}
              done={['confirmed', 'saving'].includes(status)}
            />
            <Step
              label="Confirmed on-chain"
              active={status === 'confirmed'}
              done={status === 'saving'}
            />
            <Step
              label="Saving to platform"
              active={s === 'saving'}
              done={false}
            />
          </div>
        )}

        {/* Confirmation progress bar — shown once tx is submitted */}
        {txHash && ['submitted', 'confirmed', 'saving'].includes(status) && !isError && (
          <ConfirmationBar txHash={txHash} />
        )}

        {/* BscScan link */}
        {txHash && !isError && (
          <a
            href={`${BSCSCAN}${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-body text-xs text-text-muted hover:text-forest-dark transition-colors"
          >
            <ExternalLink size={11} strokeWidth={2} />
            View on BscScan
          </a>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
