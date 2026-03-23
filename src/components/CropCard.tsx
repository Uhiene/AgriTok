import { Link } from 'react-router-dom'
import { differenceInDays } from 'date-fns'
import { TrendingUp, Clock, Sprout } from 'lucide-react'
import { motion } from 'framer-motion'
import type { CropListing } from '../types'

interface CropCardProps {
  listing: CropListing
  farmerName?: string
  imageUrl?: string
  linkPrefix?: string // '/investor/marketplace' | '/farmer/listings'
}

export default function CropCard({
  listing,
  farmerName,
  imageUrl,
  linkPrefix = '/investor/marketplace',
}: CropCardProps) {
  const fundingPercent = Math.min(
    Math.round((listing.amount_raised_usd / listing.funding_goal_usd) * 100),
    100,
  )
  const daysLeft = differenceInDays(
    new Date(listing.funding_deadline),
    new Date(),
  )
  const resolvedImage =
    imageUrl ?? listing.crop_image_url ?? null

  const formattedGoal = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(listing.funding_goal_usd)

  const formattedRaised = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(listing.amount_raised_usd)

  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: '0 4px 24px rgba(13,43,30,0.14)' }}
      transition={{ duration: 0.2 }}
      className="bg-white rounded-card shadow-card overflow-hidden flex flex-col"
    >
      {/* Image */}
      <Link to={`${linkPrefix}/${listing.id}`} className="block">
        <div className="relative aspect-[16/10] overflow-hidden bg-forest-mid/10">
          {resolvedImage ? (
            <img
              src={resolvedImage}
              alt={`${listing.crop_type} crop`}
              className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-forest-mid/20 to-accent-green/10">
              <Sprout className="w-12 h-12 text-forest-mid/40" />
            </div>
          )}
          {/* Status badge */}
          <span className="absolute top-3 left-3 px-3 py-1 rounded-pill bg-accent-green text-forest-dark text-xs font-semibold font-body uppercase tracking-wide">
            {listing.crop_type}
          </span>
        </div>
      </Link>

      {/* Body */}
      <div className="flex flex-col flex-1 p-5 gap-3">
        {/* Farmer */}
        {farmerName && (
          <p className="text-text-muted text-xs font-body">
            by {farmerName}
          </p>
        )}

        {/* Description */}
        <p className="text-text-dark text-sm font-body leading-relaxed line-clamp-2">
          {listing.description}
        </p>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-xs font-body text-text-muted">
              {formattedRaised} raised
            </span>
            <span className="text-xs font-body font-semibold text-forest-dark">
              {fundingPercent}%
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-forest-dark/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-accent-green transition-all duration-700"
              style={{ width: `${fundingPercent}%` }}
            />
          </div>
          <p className="text-xs font-body text-text-muted">
            Goal: {formattedGoal}
          </p>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-4 pt-1 border-t border-forest-dark/[0.08]">
          <div className="flex items-center gap-1.5 text-text-muted">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-xs font-body">
              {daysLeft > 0 ? `${daysLeft}d left` : 'Closed'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-accent-green">
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="text-xs font-body font-semibold">
              {listing.expected_return_percent}% est. return
            </span>
          </div>
        </div>

        {/* CTA */}
        <Link
          to={`${linkPrefix}/${listing.id}`}
          className="mt-auto block text-center py-2.5 rounded-pill bg-forest-dark text-white text-sm font-body font-semibold hover:bg-forest-mid transition-colors duration-200"
        >
          View Listing
        </Link>
      </div>
    </motion.div>
  )
}
