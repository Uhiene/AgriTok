import { supabase } from './client'
import type { CropListing, ListingStatus } from '../../types'

interface ListingFilters {
  status?: ListingStatus
  crop_type?: string
}

export async function getAllListings(
  filters: ListingFilters = {},
): Promise<CropListing[]> {
  let query = supabase
    .from('crop_listings')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters.status) {
    query = query.eq('status', filters.status)
  }
  if (filters.crop_type) {
    query = query.eq('crop_type', filters.crop_type)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getListingsByFarmer(
  farmerId: string,
): Promise<CropListing[]> {
  const { data, error } = await supabase
    .from('crop_listings')
    .select('*')
    .eq('farmer_id', farmerId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function getListingsByFarm(farmId: string): Promise<CropListing[]> {
  const { data, error } = await supabase
    .from('crop_listings')
    .select('*')
    .eq('farm_id', farmId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function getListing(listingId: string): Promise<CropListing> {
  const { data, error } = await supabase
    .from('crop_listings')
    .select('*')
    .eq('id', listingId)
    .single()

  if (error) throw error
  return data
}

export async function createListing(
  listing: Omit<CropListing, 'id' | 'created_at' | 'featured'>,
): Promise<CropListing> {
  const { data, error } = await supabase
    .from('crop_listings')
    .insert(listing)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function cancelListing(listingId: string): Promise<void> {
  const { error } = await supabase
    .from('crop_listings')
    .update({ status: 'cancelled' })
    .eq('id', listingId)

  if (error) throw error
}

export async function updateListingFunding(
  listingId: string,
  tokensAdded: number,
  amountAdded: number,
): Promise<void> {
  // Try RPC first (atomic, bypasses RLS)
  const { error: rpcError } = await supabase.rpc('increment_listing_funding', {
    p_listing_id: listingId,
    p_tokens_added: tokensAdded,
    p_amount_added: amountAdded,
  })

  if (!rpcError) return

  // Fallback: direct update (non-atomic but works for demo)
  console.warn('RPC failed, falling back to direct update:', rpcError.message)

  const { data: listing, error: fetchError } = await supabase
    .from('crop_listings')
    .select('tokens_sold, amount_raised_usd, total_tokens, status')
    .eq('id', listingId)
    .single()

  if (fetchError || !listing) throw fetchError ?? new Error('Listing not found')

  const newTokensSold = (listing.tokens_sold as number) + tokensAdded
  const newAmountRaised = (listing.amount_raised_usd as number) + amountAdded
  const updates: Record<string, unknown> = {
    tokens_sold: newTokensSold,
    amount_raised_usd: newAmountRaised,
  }
  if (newTokensSold >= (listing.total_tokens as number) && listing.status === 'open') {
    updates.status = 'funded'
  }

  const { error: updateError } = await supabase
    .from('crop_listings')
    .update(updates)
    .eq('id', listingId)

  if (updateError) throw updateError
}
