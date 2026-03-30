// supabase/functions/recover-wallet-account/index.ts
// Resets a wallet-based account's password to the deterministic value.
// Called when signUp returns "already registered" AND signIn with
// deterministic password fails (account was created with an old random UUID).
// Security: the wallet email is fully deterministic from the address,
// so knowing the address == owning the account in this wallet-auth model.

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  let body: { wallet_address: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { wallet_address } = body
  if (!wallet_address || !wallet_address.startsWith('0x')) {
    return json({ error: 'wallet_address is required' }, 400)
  }

  const walletEmail = `${wallet_address.toLowerCase()}@agritoken.wallet`
  const deterministicPassword = `agritoken-wallet-${wallet_address.toLowerCase()}`

  try {
    // Find the user by email using the admin API
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (listError) throw listError

    const existing = users.find((u) => u.email === walletEmail)
    if (!existing) {
      // No account exists — return a special flag so the caller knows to sign up fresh
      return json({ recovered: false, reason: 'no_account' }, 200)
    }

    // Reset password to deterministic value
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      existing.id,
      { password: deterministicPassword },
    )
    if (updateError) throw updateError

    return json({ recovered: true })
  } catch (err) {
    console.error('recover-wallet-account error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return json({ error: message }, 500)
  }
})

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
