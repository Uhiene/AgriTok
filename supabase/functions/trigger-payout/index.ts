// supabase/functions/trigger-payout/index.ts
// Admin-only: triggers harvest payout for a listing.
// POST { listing_id }
// Verifies caller is admin, harvest report exists + verified,
// calculates per-investor payouts, updates statuses, sends notifications.

import Stripe from 'npm:stripe@17'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { createPublicClient, createWalletClient, http, parseEther } from 'npm:viem@2'
import { privateKeyToAccount } from 'npm:viem/accounts'
import { bscTestnet } from 'npm:viem@2/chains'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
})

// Service-role client (bypasses RLS)
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const FACTORY_ADDRESS = Deno.env.get('CROP_FACTORY_ADDRESS') as `0x${string}` | undefined
const ADMIN_PRIVATE_KEY = Deno.env.get('CROP_FACTORY_PRIVATE_KEY') as `0x${string}` | undefined

const FACTORY_ABI = [
  {
    name: 'triggerPayout',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'tokenAddress', type: 'address' }],
    outputs: [],
  },
] as const

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // ── Authenticate caller — must be admin ──────────────────────────────────
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const jwt = authHeader.replace('Bearer ', '')

  // Use anon client to validate the JWT and get user
  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } },
  )

  const { data: { user }, error: authError } = await anonClient.auth.getUser()
  if (authError || !user) {
    return json({ error: 'Unauthorized' }, 401)
  }

  // Check role in profiles table
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!callerProfile || callerProfile.role !== 'admin') {
    return json({ error: 'Forbidden — admin role required' }, 403)
  }

  // ── Parse body ───────────────────────────────────────────────────────────
  let body: { listing_id: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { listing_id } = body
  if (!listing_id) {
    return json({ error: 'listing_id is required' }, 400)
  }

  try {
    // ── Fetch listing ────────────────────────────────────────────────────────
    const { data: listing, error: listingError } = await supabase
      .from('crop_listings')
      .select('*')
      .eq('id', listing_id)
      .single()

    if (listingError || !listing) {
      return json({ error: 'Listing not found' }, 404)
    }

    if (listing.status !== 'harvested') {
      return json(
        { error: `Listing must have status 'harvested' to trigger payout (current: ${listing.status})` },
        422,
      )
    }

    // ── Verify harvest report exists and is admin-verified ───────────────────
    const { data: harvestReport } = await supabase
      .from('harvest_reports')
      .select('*')
      .eq('listing_id', listing_id)
      .single()

    if (!harvestReport) {
      return json({ error: 'No harvest report found for this listing' }, 422)
    }

    if (!harvestReport.verified_by) {
      return json({ error: 'Harvest report has not been verified by an admin yet' }, 422)
    }

    // Payout yield ratio — actual / expected (caps at 1.0 for shortfalls, +bonus above 1.0)
    const yieldRatio = Math.min(
      harvestReport.actual_yield_kg / listing.expected_yield_kg,
      1.5, // cap bonus at 150% yield
    )

    // ── Fetch all confirmed investments ──────────────────────────────────────
    const { data: investments, error: invError } = await supabase
      .from('investments')
      .select('*')
      .eq('listing_id', listing_id)
      .eq('status', 'confirmed')

    if (invError) throw invError
    if (!investments || investments.length === 0) {
      return json({ error: 'No confirmed investments found for this listing' }, 422)
    }

    // ── Calculate payouts ────────────────────────────────────────────────────
    // Each investor gets: principal + (principal × expected_return_percent / 100 × yieldRatio)
    const payouts = investments.map((inv) => {
      const principal = inv.amount_paid_usd as number
      const grossProfit = (principal * listing.expected_return_percent) / 100
      const adjustedProfit = grossProfit * yieldRatio
      const totalPayout = principal + adjustedProfit
      return {
        investment: inv,
        principal,
        profit: adjustedProfit,
        totalPayout,
      }
    })

    const results: Array<{ investment_id: string; status: string; method: string; amount: number; note?: string }> = []
    const errors: string[] = []

    // ── Process payouts per investor ─────────────────────────────────────────
    for (const { investment, totalPayout, profit } of payouts) {
      const method = investment.payment_method as string

      if (method === 'stripe') {
        // For stripe investors: create a Stripe Transfer (requires connected account)
        // or mark for manual bank transfer — depending on setup.
        // Here we log the payout for manual processing (common in hackathon/demo).
        // In production: use stripe.payouts.create() with the investor's connected account.
        results.push({
          investment_id: investment.id as string,
          status: 'queued_manual',
          method: 'stripe',
          amount: totalPayout,
          note: `Manual bank transfer of $${totalPayout.toFixed(2)} queued for investor`,
        })
        console.log(
          `Stripe payout queued: investor ${investment.investor_id}, ` +
          `$${totalPayout.toFixed(2)} (principal $${investment.amount_paid_usd} + profit $${profit.toFixed(2)})`,
        )
      } else if (method === 'bnb' || method === 'usdt') {
        // On-chain payout via smart contract
        if (!FACTORY_ADDRESS || !ADMIN_PRIVATE_KEY) {
          errors.push(`Crypto payout skipped for investment ${investment.id as string}: env vars not set`)
          continue
        }

        try {
          const account = privateKeyToAccount(ADMIN_PRIVATE_KEY)

          const walletClient = createWalletClient({
            account,
            chain: bscTestnet,
            transport: http(
              Deno.env.get('BSC_TESTNET_RPC') ??
              'https://data-seed-prebsc-1-s1.binance.org:8545/',
            ),
          })

          if (listing.token_contract_address) {
            const txHash = await walletClient.writeContract({
              address: FACTORY_ADDRESS,
              abi: FACTORY_ABI,
              functionName: 'triggerPayout',
              args: [listing.token_contract_address as `0x${string}`],
            })

            results.push({
              investment_id: investment.id as string,
              status: 'on_chain_triggered',
              method,
              amount: totalPayout,
              note: `tx: ${txHash}`,
            })

            console.log(`On-chain payout tx: ${txHash} for investment ${investment.id as string}`)
          } else {
            errors.push(`No token contract address for listing ${listing_id}`)
          }
        } catch (contractErr) {
          const msg = contractErr instanceof Error ? contractErr.message : String(contractErr)
          errors.push(`Contract call failed for investment ${investment.id as string}: ${msg}`)
        }
      }
    }

    // ── Update all confirmed investments → paid_out ──────────────────────────
    const investmentIds = investments.map((i) => i.id as string)

    const { error: updateError } = await supabase
      .from('investments')
      .update({ status: 'paid_out' })
      .in('id', investmentIds)

    if (updateError) {
      console.error('Failed to update investment statuses:', updateError)
      errors.push('Failed to mark investments as paid_out')
    }

    // ── Update listing status → paid_out ─────────────────────────────────────
    const { error: listingUpdateError } = await supabase
      .from('crop_listings')
      .update({ status: 'paid_out' })
      .eq('id', listing_id)

    if (listingUpdateError) {
      console.error('Failed to update listing status:', listingUpdateError)
      errors.push('Failed to update listing status to paid_out')
    }

    // ── Also mark harvest report as payout triggered ──────────────────────────
    await supabase
      .from('harvest_reports')
      .update({ payout_triggered: true })
      .eq('listing_id', listing_id)

    // ── Send payout notifications to all investors ────────────────────────────
    const cropLabel = `${listing.crop_type.charAt(0).toUpperCase()}${listing.crop_type.slice(1)}`

    const notificationRows = payouts.map(({ investment, totalPayout, profit }) => ({
      user_id: investment.investor_id as string,
      title: 'Harvest Payout Received',
      message:
        `Your ${cropLabel} investment payout of $${totalPayout.toFixed(2)} ` +
        `(profit: +$${profit.toFixed(2)}) has been processed. ` +
        `Check your wallet and transaction history.`,
      type: 'payout' as const,
      read: false,
    }))

    const { error: notifError } = await supabase
      .from('notifications')
      .insert(notificationRows)

    if (notifError) console.warn('Failed to insert payout notifications:', notifError)

    // ── Response ──────────────────────────────────────────────────────────────
    return json({
      success: true,
      listing_id,
      yield_ratio: yieldRatio,
      investments_processed: investments.length,
      total_paid_out_usd: payouts.reduce((sum, p) => sum + p.totalPayout, 0),
      results,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    console.error('trigger-payout error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return json({ error: message }, 500)
  }
})

// ── Stripe helper — placeholder for connected-account payouts ────────────────
// In production, investors would have a Stripe Connected Account.
// This function is here to show the pattern.
async function _createStripeTransfer(
  amountCents: number,
  connectedAccountId: string,
  metadata: Record<string, string>,
): Promise<string> {
  const transfer = await stripe.transfers.create({
    amount: amountCents,
    currency: 'usd',
    destination: connectedAccountId,
    metadata,
  })
  return transfer.id
}

// Suppress unused warning for the demo helper
void _createStripeTransfer

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
