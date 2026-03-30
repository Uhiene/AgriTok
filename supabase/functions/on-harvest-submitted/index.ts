// supabase/functions/on-harvest-submitted/index.ts
// Triggered by a Supabase Database Webhook on harvest_reports INSERT.
// Sends harvestReportReceived email to all investors of that listing.
//
// Configure in Supabase Dashboard → Database → Webhooks:
//   Name:    on-harvest-submitted
//   Table:   harvest_reports
//   Events:  INSERT
//   URL:     https://<project>.supabase.co/functions/v1/on-harvest-submitted
//   Headers: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>

import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

interface HarvestReportRecord {
  id: string
  listing_id: string
  actual_yield_kg: number
}

interface WebhookPayload {
  type: 'INSERT'
  table: string
  record: HarvestReportRecord
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

  const { listing_id } = payload.record

  // Fetch listing + farmer profile
  const { data: listing, error: listingError } = await supabase
    .from('crop_listings')
    .select('id, crop_type, farmer_id')
    .eq('id', listing_id)
    .single()

  if (listingError || !listing) {
    console.error(`on-harvest-submitted: listing ${listing_id} not found:`, listingError)
    return new Response(JSON.stringify({ error: 'Listing not found' }), { status: 200 })
  }

  const { data: farmerProfile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', listing.farmer_id)
    .single()

  const farmerName = farmerProfile?.full_name ?? 'The farmer'
  const cropLabel = listing.crop_type.charAt(0).toUpperCase() + listing.crop_type.slice(1)

  // Fetch all confirmed investments for this listing
  const { data: investments, error: invError } = await supabase
    .from('investments')
    .select('investor_id')
    .eq('listing_id', listing_id)
    .eq('status', 'confirmed')

  if (invError || !investments?.length) {
    console.log(`on-harvest-submitted: no confirmed investments for listing ${listing_id}`)
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 })
  }

  // Deduplicate investor IDs
  const uniqueInvestorIds = [...new Set(investments.map((i: { investor_id: string }) => i.investor_id))]

  // Resolve emails and send in parallel — one per investor
  const tasks = uniqueInvestorIds.map(async (investorId) => {
    try {
      const { data: { user }, error } = await supabase.auth.admin.getUserById(investorId)
      if (error || !user?.email) return

      const { data: investorProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', investorId)
        .single()

      const investorName = investorProfile?.full_name ?? user.email.split('@')[0]

      await callSendEmail(user.email, 'harvestReportReceived', {
        investor: investorName,
        crop:     cropLabel,
        farmer:   farmerName,
      })
    } catch (err) {
      console.warn(`on-harvest-submitted: failed to notify investor ${investorId}:`, err)
    }
  })

  await Promise.allSettled(tasks)

  console.log(`on-harvest-submitted: notified ${uniqueInvestorIds.length} investors for listing ${listing_id}`)

  return new Response(JSON.stringify({ sent: uniqueInvestorIds.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
