import { supabase } from './client'
import type { KycSubmission } from '../../types'

export async function getLatestKycSubmission(userId: string): Promise<KycSubmission | null> {
  const { data, error } = await supabase
    .from('kyc_submissions')
    .select('*')
    .eq('user_id', userId)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function upsertKycSubmission(
  submission: Omit<KycSubmission, 'id' | 'submitted_at' | 'reviewed_at' | 'reviewed_by' | 'rejection_reason'>,
): Promise<KycSubmission> {
  // Delete any existing submission — ignore errors (table may be empty or row may not exist)
  await supabase.from('kyc_submissions').delete().eq('user_id', submission.user_id).then(() => null)

  // Bypass supabase-js auth queue (can hang/fail) — use raw fetch with explicit token
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token ?? supabaseKey

  const res = await fetch(`${supabaseUrl}/rest/v1/kyc_submissions`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':         supabaseKey,
      'Authorization': `Bearer ${token}`,
      'Prefer':        'return=representation',
    },
    body:   JSON.stringify({ ...submission, rejection_reason: null }),
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`KYC insert failed (${res.status}): ${body}`)
  }

  const rows = await res.json() as KycSubmission[]
  const row  = rows[0]
  if (!row) throw new Error('KYC insert returned no data')
  return row
}

export async function uploadKycDoc(
  userId: string,
  file: File,
  slot: 'front' | 'back' | 'selfie' | 'cert',
): Promise<string> {
  const ext  = file.name.split('.').pop() ?? 'jpg'
  const path = `${userId}/${slot}-${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('kyc-documents')
    .upload(path, file, { upsert: true })

  if (error) throw error

  const { data: { publicUrl } } = supabase.storage
    .from('kyc-documents')
    .getPublicUrl(path)

  return publicUrl
}
