// supabase/functions/stripe-webhook/index.ts
// Handles Stripe webhook events.
// Verifies signature, processes payment_intent.succeeded,
// updates investment + listing, sends notifications.

import Stripe from 'npm:stripe@17'
import { createClient } from 'npm:@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  // Read raw body for signature verification
  const rawBody = await req.arrayBuffer()
  const bodyText = new TextDecoder().decode(rawBody)

  // ── Verify Stripe signature ──────────────────────────────────────────────
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(bodyText, signature, WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return new Response('Webhook signature verification failed', { status: 400 })
  }

  // ── Route events ─────────────────────────────────────────────────────────
  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent)
        break

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent)
        break

      default:
        // Acknowledge unhandled events
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(`Error handling ${event.type}:`, err)
    // Return 200 anyway so Stripe doesn't retry — log the error separately
    return new Response(JSON.stringify({ received: true, error: 'handler failed' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

// ── payment_intent.succeeded ─────────────────────────────────────────────────
async function handlePaymentSucceeded(intent: Stripe.PaymentIntent) {
  const { listing_id, investor_id, farmer_id, tokens_count, crop_type } = intent.metadata

  if (!listing_id || !investor_id || !tokens_count) {
    console.warn('payment_intent.succeeded missing metadata, skipping:', intent.id)
    return
  }

  const tokensCount = parseInt(tokens_count, 10)
  const amountUsd = intent.amount / 100 // cents → dollars

  // 1. Update investment: pending → confirmed
  const { error: invError } = await supabase
    .from('investments')
    .update({ status: 'confirmed' })
    .eq('transaction_hash', intent.id)
    .eq('status', 'pending')

  if (invError) {
    console.error('Failed to update investment status:', invError)
    throw invError
  }

  // 2. Atomically increment listing funding counters via RPC
  const { error: rpcError } = await supabase.rpc('increment_listing_funding', {
    p_listing_id: listing_id,
    p_tokens_added: tokensCount,
    p_amount_added: amountUsd,
  })

  if (rpcError) {
    console.error('Failed to update listing funding:', rpcError)
    // Non-fatal — investment is confirmed; listing counter will sync on next read
  }

  // 3. Check if listing is now fully funded and update status
  const { data: listing } = await supabase
    .from('crop_listings')
    .select('total_tokens, tokens_sold, status')
    .eq('id', listing_id)
    .single()

  if (listing && listing.tokens_sold >= listing.total_tokens && listing.status === 'open') {
    await supabase
      .from('crop_listings')
      .update({ status: 'funded' })
      .eq('id', listing_id)
  }

  // 4. Send notifications (non-fatal if they fail)
  const cropLabel = crop_type
    ? `${crop_type.charAt(0).toUpperCase()}${crop_type.slice(1)}`
    : 'Crop'

  const notifications = [
    {
      user_id: investor_id,
      title: 'Investment Confirmed',
      message: `Your card payment of $${amountUsd.toFixed(2)} for ${tokensCount} ${cropLabel} tokens has been confirmed.`,
      type: 'investment' as const,
      read: false,
    },
  ]

  if (farmer_id) {
    notifications.push({
      user_id: farmer_id,
      title: 'New Investment Received',
      message: `An investor purchased ${tokensCount} ${cropLabel} tokens, raising $${amountUsd.toFixed(2)} for your listing.`,
      type: 'investment' as const,
      read: false,
    })
  }

  const { error: notifError } = await supabase.from('notifications').insert(notifications)
  if (notifError) console.warn('Failed to insert notifications:', notifError)

  console.log(`payment_intent.succeeded processed: ${intent.id}, listing: ${listing_id}`)
}

// ── payment_intent.payment_failed ────────────────────────────────────────────
async function handlePaymentFailed(intent: Stripe.PaymentIntent) {
  const { investor_id } = intent.metadata
  if (!investor_id) return

  // Delete the pending investment record so the user can retry
  await supabase
    .from('investments')
    .delete()
    .eq('transaction_hash', intent.id)
    .eq('status', 'pending')

  // Optionally notify investor
  const failureMessage = intent.last_payment_error?.message ?? 'Payment declined'
  await supabase.from('notifications').insert({
    user_id: investor_id,
    title: 'Payment Failed',
    message: `Your investment payment could not be processed: ${failureMessage}. Please try again.`,
    type: 'investment',
    read: false,
  })

  console.log(`payment_intent.payment_failed handled: ${intent.id}`)
}
