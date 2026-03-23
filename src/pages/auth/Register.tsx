import { useSearchParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sprout, TrendingUp, ArrowLeft, Wallet } from 'lucide-react'

export default function Register() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const wallet = params.get('wallet')

  return (
    <div className="min-h-screen bg-cream flex flex-col">

      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between max-w-7xl mx-auto w-full">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-text-muted hover:text-forest-dark transition-colors font-body text-sm"
        >
          <ArrowLeft size={16} strokeWidth={2} />
          Back
        </button>
        <span className="font-display text-xl text-forest-dark">AgriToken</span>
        <div className="w-16" />
      </header>

      {/* Body */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">

        {/* Wallet notice */}
        {wallet && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-pill bg-forest-dark/5 border border-forest-dark/10 mb-8"
          >
            <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
            <Wallet size={14} className="text-text-muted" strokeWidth={2} />
            <span className="font-mono text-xs text-forest-dark">
              {wallet.slice(0, 6)}...{wallet.slice(-4)}
            </span>
            <span className="font-body text-xs text-text-muted">wallet detected</span>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h1 className="font-display text-4xl sm:text-5xl text-forest-dark mb-3">
            Join AgriToken
          </h1>
          <p className="font-body text-text-muted text-base max-w-sm mx-auto">
            Choose how you want to participate in the future of crop finance.
          </p>
        </motion.div>

        {/* Role cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">

          {/* Farmer card */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div
              onClick={() => navigate(`/register/farmer${wallet ? `?wallet=${wallet}` : ''}`)}
              className="group bg-white rounded-modal shadow-card hover:shadow-card-hover border border-[rgba(13,43,30,0.08)] p-8 cursor-pointer transition-all duration-300 hover:-translate-y-1 flex flex-col gap-6 h-full"
            >
              <div className="w-14 h-14 rounded-card bg-accent-green/10 flex items-center justify-center group-hover:bg-accent-green/20 transition-colors duration-300">
                <Sprout size={28} className="text-forest-mid" strokeWidth={1.75} />
              </div>

              <div className="flex-1">
                <h2 className="font-display text-2xl text-forest-dark mb-2">
                  I am a Farmer
                </h2>
                <p className="font-body text-text-muted text-sm leading-relaxed">
                  Tokenize your future harvest, raise capital before the season starts,
                  and receive funding directly to your wallet.
                </p>
              </div>

              <ul className="space-y-2">
                {[
                  'Raise pre-harvest capital',
                  'Mint crop tokens on BNB Chain',
                  'Receive funds in USDT or BNB',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 font-body text-xs text-text-muted">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent-green flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>

              <button className="w-full py-3 rounded-card bg-forest-dark text-white font-body font-semibold text-sm group-hover:bg-forest-mid transition-colors duration-300">
                Register as Farmer
              </button>
            </div>
          </motion.div>

          {/* Investor card */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div
              onClick={() => navigate(`/register/investor${wallet ? `?wallet=${wallet}` : ''}`)}
              className="group bg-white rounded-modal shadow-card hover:shadow-card-hover border border-[rgba(13,43,30,0.08)] p-8 cursor-pointer transition-all duration-300 hover:-translate-y-1 flex flex-col gap-6 h-full"
            >
              <div className="w-14 h-14 rounded-card bg-gold/10 flex items-center justify-center group-hover:bg-gold/20 transition-colors duration-300">
                <TrendingUp size={28} className="text-gold" strokeWidth={1.75} />
              </div>

              <div className="flex-1">
                <h2 className="font-display text-2xl text-forest-dark mb-2">
                  I am an Investor
                </h2>
                <p className="font-body text-text-muted text-sm leading-relaxed">
                  Browse verified crop listings, buy harvest tokens, and earn
                  real yield backed by real agricultural output.
                </p>
              </div>

              <ul className="space-y-2">
                {[
                  'Browse verified crop listings',
                  'Invest with USDT, BNB, or card',
                  'Track returns on-chain',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 font-body text-xs text-text-muted">
                    <div className="w-1.5 h-1.5 rounded-full bg-gold flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>

              <button className="w-full py-3 rounded-card bg-accent-green text-forest-dark font-body font-semibold text-sm group-hover:bg-accent-green/90 transition-colors duration-300">
                Register as Investor
              </button>
            </div>
          </motion.div>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8 font-body text-sm text-text-muted"
        >
          Already have an account?{' '}
          <button
            onClick={() => navigate('/login')}
            className="text-accent-green font-medium hover:underline"
          >
            Sign in
          </button>
        </motion.p>
      </div>
    </div>
  )
}
