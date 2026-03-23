import { supabase } from './client'
import type { HarvestReport } from '../../types'

export async function getHarvestReport(
  listingId: string,
): Promise<HarvestReport | null> {
  const { data, error } = await supabase
    .from('harvest_reports')
    .select('*')
    .eq('listing_id', listingId)
    .maybeSingle()

  if (error) throw error
  return data
}
