// ============================================================
// Enum / Union Types
// ============================================================

export type UserRole = 'farmer' | 'investor' | 'admin'

export type KycStatus = 'pending' | 'verified' | 'rejected'

export type ListingStatus =
  | 'open'
  | 'funded'
  | 'harvested'
  | 'paid_out'
  | 'cancelled'

export type InvestmentStatus = 'pending' | 'confirmed' | 'paid_out'

export type PaymentMethod = 'stripe' | 'bnb' | 'usdt'

export type NotificationType = 'investment' | 'payout' | 'weather' | 'system'

// ============================================================
// Table: profiles
// ============================================================

export interface NotificationPrefs {
  investment: boolean
  payout:     boolean
  weather:    boolean
  system:     boolean
}

export interface Profile {
  id: string
  wallet_address: string | null
  role: UserRole
  full_name: string
  avatar_url: string | null
  country: string | null
  phone: string | null
  kyc_status: KycStatus
  notification_prefs: NotificationPrefs | null
  created_at: string
  updated_at: string
}

// ============================================================
// Table: farms
// ============================================================

export interface Farm {
  id: string
  farmer_id: string
  name: string
  location_name: string
  latitude: number
  longitude: number
  acreage: number
  soil_type: string
  irrigation_type: string
  verified: boolean
  created_at: string
}

// ============================================================
// Table: crop_listings
// ============================================================

export interface CropListing {
  id: string
  farm_id: string
  farmer_id: string
  crop_type: string
  crop_image_url: string | null
  expected_yield_kg: number
  price_per_token_usd: number
  total_tokens: number
  tokens_sold: number
  funding_goal_usd: number
  amount_raised_usd: number
  funding_deadline: string
  harvest_date: string
  expected_return_percent: number
  status: ListingStatus
  token_contract_address: string | null
  description: string
  featured: boolean
  created_at: string
}

// ============================================================
// Table: investments
// ============================================================

export interface Investment {
  id: string
  investor_id: string
  listing_id: string
  tokens_purchased: number
  amount_paid_usd: number
  payment_method: PaymentMethod
  transaction_hash: string | null
  status: InvestmentStatus
  created_at: string
}

// ============================================================
// Table: harvest_reports
// ============================================================

export interface HarvestReport {
  id: string
  listing_id: string
  actual_yield_kg: number
  harvest_photos: string[]
  verified_by: string | null
  payout_triggered: boolean
  created_at: string
}

// ============================================================
// Table: farm_notes
// ============================================================

export interface FarmNote {
  id: string
  farm_id: string
  farmer_id: string
  note: string
  note_type?: string | null
  photo_url: string | null
  created_at: string
}

// ============================================================
// Table: kyc_submissions
// ============================================================

export type DocType = 'national_id' | 'passport' | 'drivers_license'

export interface KycSubmission {
  id:               string
  user_id:          string
  full_legal_name:  string
  date_of_birth:    string | null
  nationality:      string
  phone:            string
  doc_type:         DocType
  doc_front_url:    string | null
  doc_back_url:     string | null
  selfie_url:       string | null
  farm_cert_url:    string | null
  land_titled:      boolean
  gps_lat:          number | null
  gps_lng:          number | null
  rejection_reason: string | null
  submitted_at:     string
  reviewed_at:      string | null
  reviewed_by:      string | null
}

// ============================================================
// Table: notifications
// ============================================================

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: NotificationType
  read: boolean
  created_at: string
}
