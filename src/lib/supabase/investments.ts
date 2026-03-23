import { supabase } from './client'
import type { CropListing, Investment, InvestmentStatus } from '../../types'

export interface InvestmentWithListing extends Investment {
  listing: CropListing | null
}

export async function getInvestmentsWithListings(
  investorId: string,
  limit?: number,
): Promise<InvestmentWithListing[]> {
  let query = supabase
    .from('investments')
    .select('*, listing:crop_listings(*)')
    .eq('investor_id', investorId)
    .order('created_at', { ascending: false })

  if (limit) query = query.limit(limit)

  const { data, error } = await query
  if (error) throw error
  return data as InvestmentWithListing[]
}

export async function getInvestmentsByInvestor(
  investorId: string,
): Promise<Investment[]> {
  const { data, error } = await supabase
    .from('investments')
    .select('*')
    .eq('investor_id', investorId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function getInvestmentsByListing(
  listingId: string,
): Promise<Investment[]> {
  const { data, error } = await supabase
    .from('investments')
    .select('*')
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function createInvestment(
  investment: Omit<Investment, 'id' | 'created_at'>,
): Promise<Investment> {
  const { data, error } = await supabase
    .from('investments')
    .insert(investment)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getInvestmentsByFarmer(
  farmerId: string,
): Promise<InvestmentWithListing[]> {
  const { data, error } = await supabase
    .from('investments')
    .select('*, listing:crop_listings!inner(*)')
    .eq('listing.farmer_id', farmerId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as InvestmentWithListing[]
}

export async function getInvestmentWithListing(
  investmentId: string,
): Promise<InvestmentWithListing> {
  const { data, error } = await supabase
    .from('investments')
    .select('*, listing:crop_listings(*)')
    .eq('id', investmentId)
    .single()

  if (error) throw error
  return data as InvestmentWithListing
}

export async function updateInvestmentStatus(
  investmentId: string,
  status: InvestmentStatus,
  txHash?: string,
): Promise<void> {
  const updates: Partial<Investment> = { status }
  if (txHash !== undefined) {
    updates.transaction_hash = txHash
  }

  const { error } = await supabase
    .from('investments')
    .update(updates)
    .eq('id', investmentId)

  if (error) throw error
}
