import { supabase } from './client'
import type { Farm } from '../../types'

export async function getFarmsByFarmer(farmerId: string): Promise<Farm[]> {
  const { data, error } = await supabase
    .from('farms')
    .select('*')
    .eq('farmer_id', farmerId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function getFarm(farmId: string): Promise<Farm> {
  const { data, error } = await supabase
    .from('farms')
    .select('*')
    .eq('id', farmId)
    .single()

  if (error) throw error
  return data
}

export async function createFarm(
  farm: Omit<Farm, 'id' | 'created_at'>,
): Promise<Farm> {
  const { data, error } = await supabase
    .from('farms')
    .insert(farm)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateFarm(
  farmId: string,
  updates: Partial<Farm>,
): Promise<Farm> {
  const { data, error } = await supabase
    .from('farms')
    .update(updates)
    .eq('id', farmId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteFarm(farmId: string): Promise<void> {
  const { error } = await supabase
    .from('farms')
    .delete()
    .eq('id', farmId)

  if (error) throw error
}
