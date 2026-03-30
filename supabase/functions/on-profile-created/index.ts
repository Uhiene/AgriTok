// supabase/functions/on-profile-created/index.ts
// Triggered by a Supabase Database Webhook on profiles INSERT.
// Sends a welcome email to new farmers and investors.
//
// Configure in Supabase Dashboard → Database → Webhooks:
//   Name:    on-profile-created
//   Table:   profiles
//   Events:  INSERT
//   URL:     https://<project>.supabase.co/functions/v1/on-profile-created
//   Headers: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>

import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

interface ProfileRecord {
  id: string
  full_name: string | null
  role: 'farmer' | 'investor' | 'admin'
}

interface WebhookPayload {
  type: 'INSERT'
  table: string
  record: ProfileRecord
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

  const profile = payload.record

  // Skip admin accounts — no welcome email for admins
  if (profile.role === 'admin') {
    return new Response(JSON.stringify({ skipped: 'admin role' }), { status: 200 })
  }

  // Get user's email from auth.users via admin API
  const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(profile.id)

  if (userError || !user?.email) {
    console.error(`on-profile-created: could not get email for user ${profile.id}:`, userError)
    return new Response(JSON.stringify({ error: 'Could not resolve user email' }), { status: 200 })
  }

  const name = profile.full_name ?? user.email.split('@')[0]
  const template = profile.role === 'farmer' ? 'welcomeFarmer' : 'welcomeInvestor'

  await callSendEmail(user.email, template, { name })

  console.log(`on-profile-created: sent ${template} to ${user.email}`)

  return new Response(JSON.stringify({ sent: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
