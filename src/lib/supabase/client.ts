import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Preserve a single client instance across Vite HMR reloads.
// import.meta.hot.data survives module re-evaluation; globalThis handles the
// initial load and non-HMR contexts (prod build, SSR, etc.).

declare global {
  // eslint-disable-next-line no-var
  var __agritoken_supabase__: SupabaseClient | undefined
}

type HotData = { supabase?: SupabaseClient }

function make() {
  return createClient(
    import.meta.env.VITE_SUPABASE_URL as string,
    import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    {
      auth: {
        // Bypass Web Locks entirely. The default lock serializes auth token
        // refreshes via the browser Web Locks API. In practice this deadlocks
        // whenever two client instances exist simultaneously (Vite HMR, multiple
        // tabs, service workers) — causing getSession() and every REST/storage
        // call to hang indefinitely. Bypassing is safe for a single-client SPA:
        // concurrent getSession() calls all run immediately and Supabase's server
        // deduplicates concurrent refresh requests.
        lock: (_n: string, _t: number, fn: () => Promise<unknown>) => fn(),
      },
    },
  )
}

const hot = import.meta.hot as { data: HotData } | undefined

let client: SupabaseClient

if (hot?.data.supabase) {
  client = hot.data.supabase
} else if (globalThis.__agritoken_supabase__) {
  client = globalThis.__agritoken_supabase__
} else {
  client = make()
  globalThis.__agritoken_supabase__ = client
}

if (hot) hot.data.supabase = client

export const supabase = client
