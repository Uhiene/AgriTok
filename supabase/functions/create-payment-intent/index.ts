// supabase/functions/create-payment-intent/index.ts
// Creates a Stripe PaymentIntent and a pending investment record.
// POST { listing_id, investor_id, tokens_count, amount_usd }
// Returns { client_secret, investment_id }

import Stripe from 'npm:stripe@17'
import { createClient } from 'npm:@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const body = await req.json() as {
      listing_id: string
      investor_id: string
      tokens_count: number
      amount_usd: number
    }

    const { listing_id, investor_id, tokens_count, amount_usd } = body

    // ── Validate inputs ─────────────────────────────────────────────────────
    if (!listing_id || !investor_id || !tokens_count || !amount_usd) {
      return json({ error: 'Missing required fields' }, 400)
    }

    if (tokens_count < 1 || !Number.isInteger(tokens_count)) {
      return json({ error: 'tokens_count must be a positive integer' }, 400)
    }

    if (amount_usd <= 0) {
      return json({ error: 'amount_usd must be positive' }, 400)
    }

    // ── Fetch listing ────────────────────────────────────────────────────────
    const { data: listing, error: listingError } = await supabase
      .from('crop_listings')
      .select('id, crop_type, status, total_tokens, tokens_sold, price_per_token_usd, farmer_id')
      .eq('id', listing_id)
      .single()

    if (listingError || !listing) {
      return json({ error: 'Listing not found' }, 404)
    }

    if (listing.status !== 'open') {
      return json({ error: `Listing is not open for investment (status: ${listing.status})` }, 422)
    }

    const tokensAvailable = listing.total_tokens - listing.tokens_sold
    if (tokens_count > tokensAvailable) {
      return json(
        { error: `Only ${tokensAvailable} tokens remaining — requested ${tokens_count}` },
        422,
      )
    }

    // ── Validate amount matches price (prevent tampering) ───────────────────
    const expectedAmount = Math.round(tokens_count * listing.price_per_token_usd * 100)
    const requestedAmount = Math.round(amount_usd * 100)

    if (Math.abs(expectedAmount - requestedAmount) > 1) {
      // Allow 1 cent rounding tolerance
      return json(
        { error: `Amount mismatch: expected $${(expectedAmount / 100).toFixed(2)}, got $${amount_usd}` },
        422,
      )
    }

    // ── Create Stripe PaymentIntent ──────────────────────────────────────────
    const amountCents = expectedAmount

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      payment_method_types: ['card'],
      metadata: {
        listing_id,
        investor_id,
        farmer_id: listing.farmer_id,
        tokens_count: String(tokens_count),
        crop_type: listing.crop_type,
      },
    })

    // ── Create pending investment record ─────────────────────────────────────
    const { data: investment, error: investmentError } = await supabase
      .from('investments')
      .insert({
        investor_id,
        listing_id,
        tokens_purchased: tokens_count,
        amount_paid_usd: amount_usd,
        payment_method: 'stripe',
        transaction_hash: paymentIntent.id,
        status: 'pending',
      })
      .select('id')
      .single()

    if (investmentError || !investment) {
      // Roll back intent if we can
      await stripe.paymentIntents.cancel(paymentIntent.id).catch(() => {})
      console.error('Investment insert error:', investmentError)
      return json({ error: 'Failed to create investment record' }, 500)
    }

    return json({
      client_secret: paymentIntent.client_secret,
      investment_id: investment.id,
    })
  } catch (err) {
    console.error('create-payment-intent error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
