import { supabase } from './client'
import type { FarmNote } from '../../types'

export async function getNotesByFarmer(farmerId: string): Promise<FarmNote[]> {
  const { data, error } = await supabase
    .from('farm_notes')
    .select('*')
    .eq('farmer_id', farmerId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function getNotesByFarm(farmId: string): Promise<FarmNote[]> {
  const { data, error } = await supabase
    .from('farm_notes')
    .select('*')
    .eq('farm_id', farmId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function createNote(
  note: Omit<FarmNote, 'id' | 'created_at'>,
): Promise<FarmNote> {
  const { data, error } = await supabase
    .from('farm_notes')
    .insert(note)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteNote(noteId: string): Promise<void> {
  const { error } = await supabase
    .from('farm_notes')
    .delete()
    .eq('id', noteId)

  if (error) throw error
}
