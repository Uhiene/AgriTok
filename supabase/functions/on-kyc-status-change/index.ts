// supabase/functions/on-kyc-status-change/index.ts
// Triggered by a Supabase Database Webhook on profiles UPDATE.
// Sends kycApproved or kycRejected email when kyc_status changes.
//
// Configure in Supabase Dashboard → Database → Webhooks:
//   Name:    on-kyc-status-change
//   Table:   profiles
//   Events:  UPDATE
//   URL:     https://<project>.supabase.co/functions/v1/on-kyc-status-change
//   Headers: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
//
// NOTE: Enable REPLICA IDENTITY FULL on the profiles table so old_record
// fields are available:
//   ALTER TABLE profiles REPLICA IDENTITY FULL;

import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

interface ProfileRecord {
  id: string
  full_name: string | null
  role: string
  kyc_status: 'pending' | 'verified' | 'rejected' | null
}

interface WebhookPayload {
  type: 'UPDATE'
  table: string
  record: ProfileRecord
  old_record: Partial<ProfileRecord>
  schema: string
}

async function callSendEmail(
  to: string,
  template_name: string,
  template_data: Record<string, string | number>,
) {
  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ to, template_name, template_data }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.warn(`send-email returned ${res.status}: ${text}`)
    }
  } catch (err) {
    console.warn('Failed to call send-email:', err)
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let payload: WebhookPayload
  try {
    payload = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { record, old_record } = payload
  const newStatus = record.kyc_status
  const oldStatus = old_record?.kyc_status

  // Skip if status did not change (when REPLICA IDENTITY FULL is set)
  if (oldStatus !== undefined && oldStatus === newStatus) {
    return new Response(JSON.stringify({ skipped: 'status unchanged' }), { status: 200 })
  }

  // Only act on verified or rejected
  if (newStatus !== 'verified' && newStatus !== 'rejected') {
    return new Response(JSON.stringify({ skipped: `status is ${newStatus}` }), { status: 200 })
  }

  // Get user email
  const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(record.id)

  if (userError || !user?.email) {
    console.error(`on-kyc-status-change: could not get email for user ${record.id}:`, userError)
    return new Response(JSON.stringify({ error: 'Could not resolve user email' }), { status: 200 })
  }

  const name = record.full_name ?? user.email.split('@')[0]

  if (newStatus === 'verified') {
    await callSendEmail(user.email, 'kycApproved', { farmer: name })
    console.log(`on-kyc-status-change: kycApproved sent to ${user.email}`)
  } else {
    // Look up rejection reason from kyc_submissions
    const { data: submission } = await supabase
      .from('kyc_submissions')
      .select('rejection_reason')
      .eq('user_id', record.id)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const reason = submission?.rejection_reason ?? 'Documents could not be verified. Please resubmit clear, valid documents.'

    await callSendEmail(user.email, 'kycRejected', { farmer: name, reason })
    console.log(`on-kyc-status-change: kycRejected sent to ${user.email}`)
  }

  return new Response(JSON.stringify({ sent: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
