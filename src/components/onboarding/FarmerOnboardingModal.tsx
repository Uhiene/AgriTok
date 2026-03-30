// src/components/onboarding/FarmerOnboardingModal.tsx
// Step-by-step onboarding modals for new farmers.
// Each step shows once — dismissed state is persisted in localStorage.

import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sprout, Coins, LayoutDashboard, MessageSquare, ArrowRight } from 'lucide-react'

// ── Persistence ────────────────────────────────────────────────

const STORAGE_KEY = 'agritoken-onboarding-farmer'

interface OnboardingState {
  dismissedSteps: number[]
}

function getState(): OnboardingState {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{"dismissedSteps":[]}') as OnboardingState
  } catch {
    return { dismissedSteps: [] }
  }
}

function dismissStep(step: number) {
  const state = getState()
  if (!state.dismissedSteps.includes(step)) {
    state.dismissedSteps.push(step)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }
}

export function isStepDismissed(step: number): boolean {
  return getState().dismissedSteps.includes(step)
}

// ── Step definitions ───────────────────────────────────────────

interface StepConfig {
  step: number
  icon: React.ElementType
  iconBg: string
  iconColor: string
  badge: string
  title: string
  body: string
  cta: string
  ctaPath: string
  skipLabel: string
}

const STEPS: StepConfig[] = [
  {
    step: 1,
    icon: Sprout,
    iconBg: 'bg-accent-green/15',
    iconColor: 'text-forest-mid',
    badge: 'Step 1 of 4',
    title: 'Create your first farm',
    body: 'Start by registering your farm. Add your location, acreage, and soil type so investors can discover your land.',
    cta: 'Create Farm',
    ctaPath: '/farmer/farms/new',
    skipLabel: 'Skip for now',
  },
  {
    step: 2,
    icon: Coins,
    iconBg: 'bg-gold/15',
    iconColor: 'text-[#A8860A]',
    badge: 'Step 2 of 4',
    title: 'Tokenize your crops on BNB Chain',
    body: 'Turn your future harvest into digital tokens. Investors can fund your crop in exchange for a share of the profit at harvest time.',
    cta: 'Tokenize Crops',
    ctaPath: '/farmer/listings/new',
    skipLabel: 'I will do this later',
  },
  {
    step: 3,
    icon: LayoutDashboard,
    iconBg: 'bg-forest-mid/10',
    iconColor: 'text-forest-mid',
    badge: 'Step 3 of 4',
    title: 'Your listing is live',
    body: 'Investors can now discover and fund your crop. Track funding progress and manage all your active listings from one place.',
    cta: 'View My Listings',
    ctaPath: '/farmer/listings',
    skipLabel: 'Got it',
  },
  {
    step: 4,
    icon: MessageSquare,
    iconBg: 'bg-accent-green/15',
    iconColor: 'text-forest-mid',
    badge: 'Step 4 of 4',
    title: 'Ask the AI anything about your crops',
    body: 'Your dashboard has a built-in AI advisor. Ask it about planting seasons, pest control, market prices, or anything farming-related.',
    cta: 'Try AI Advisor',
    ctaPath: '/farmer/dashboard#ai',
    skipLabel: 'Finish setup',
  },
]

// ── Modal component ────────────────────────────────────────────

interface Props {
  stepNumber: number
  onDismiss: () => void
}

export default function FarmerOnboardingModal({ stepNumber, onDismiss }: Props) {
  const navigate = useNavigate()
  const config = STEPS.find((s) => s.step === stepNumber)
  if (!config) return null

  const Icon = config.icon

  function handleCta() {
    dismissStep(stepNumber)
    onDismiss()
    if (config.ctaPath.includes('#')) {
      const [path, hash] = config.ctaPath.split('#')
      navigate(path)
      setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' })
      }, 300)
    } else {
      navigate(config.ctaPath)
    }
  }

  function handleSkip() {
    dismissStep(stepNumber)
    onDismiss()
  }

  return (
    <AnimatePresence>
      <motion.div
        key={`onboarding-${stepNumber}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-forest-dark/40 backdrop-blur-sm"
          onClick={handleSkip}
        />

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className="relative z-10 w-full sm:max-w-md bg-white rounded-t-[28px] sm:rounded-[24px] shadow-2xl overflow-hidden mx-0 sm:mx-4"
        >
          {/* Progress bar */}
          <div className="absolute top-0 inset-x-0 h-1 bg-forest-dark/[0.06]">
            <motion.div
              className="h-full bg-accent-green"
              initial={{ width: 0 }}
              animate={{ width: `${(stepNumber / STEPS.length) * 100}%` }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
            />
          </div>

          {/* Close button */}
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:bg-forest-dark/[0.06] hover:text-forest-dark transition-colors"
          >
            <X size={16} strokeWidth={2.5} />
          </button>

          <div className="px-6 pt-8 pb-7 space-y-5">

            {/* Icon + badge */}
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl ${config.iconBg} flex items-center justify-center flex-shrink-0`}>
                <Icon size={22} strokeWidth={1.75} className={config.iconColor} />
              </div>
              <span className="font-body text-xs font-semibold text-text-muted uppercase tracking-wider">
                {config.badge}
              </span>
            </div>

            {/* Text */}
            <div className="space-y-2">
              <h2 className="font-display text-2xl text-forest-dark leading-snug">
                {config.title}
              </h2>
              <p className="font-body text-sm text-text-muted leading-relaxed">
                {config.body}
              </p>
            </div>

            {/* Step dots */}
            <div className="flex items-center gap-1.5">
              {STEPS.map((s) => (
                <div
                  key={s.step}
                  className={`rounded-full transition-all duration-300 ${
                    s.step === stepNumber
                      ? 'w-5 h-1.5 bg-accent-green'
                      : s.step < stepNumber
                      ? 'w-1.5 h-1.5 bg-accent-green/40'
                      : 'w-1.5 h-1.5 bg-forest-dark/10'
                  }`}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="space-y-2.5 pt-1">
              <button
                onClick={handleCta}
                className="w-full h-12 rounded-pill bg-forest-dark text-white font-body text-sm font-semibold flex items-center justify-center gap-2 hover:bg-forest-mid transition-colors"
              >
                {config.cta}
                <ArrowRight size={15} strokeWidth={2.5} />
              </button>
              <button
                onClick={handleSkip}
                className="w-full h-10 rounded-pill font-body text-sm text-text-muted hover:text-forest-dark hover:bg-forest-dark/[0.04] transition-colors"
              >
                {config.skipLabel}
              </button>
            </div>

          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
