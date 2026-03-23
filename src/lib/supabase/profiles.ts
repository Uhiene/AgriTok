import { supabase } from './client'
import type { Profile, KycStatus } from '../../types'

export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) throw error
  return data
}

export async function upsertProfile(profile: Partial<Profile> & { id: string }): Promise<Profile> {
  const { id, ...fields } = profile

  // Try update first (profile exists after registration trigger).
  // id must NOT be in the update body — PostgREST rejects primary key updates.
  const { data, error } = await supabase
    .from('profiles')
    .update(fields)
    .eq('id', id)
    .select()
    .single()

  if (!error) {
    if (!data) throw new Error('Profile update returned no data')
    return data
  }

  // Fall back to upsert if row doesn't exist yet
  const { data: upserted, error: upsertError } = await supabase
    .from('profiles')
    .upsert(profile)
    .select()
    .single()

  if (upsertError) throw upsertError
  if (!upserted) throw new Error('Profile upsert returned no data')
  return upserted
}

export async function getProfileByWallet(
  walletAddress: string,
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('wallet_address', walletAddress)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function updateKYCStatus(
  userId: string,
  status: KycStatus,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ kyc_status: status })
    .eq('id', userId)

  if (error) throw error
}
