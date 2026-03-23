// crop-advisor — Groq-powered AI advisory for AgriTok (free tier)
// Handles three modes: advisory (farmer 3-point advice), chat (streaming Q&A), investor (market signal)

import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MODEL   = 'llama-3.3-70b-versatile'
const API_URL = 'https://api.groq.com/openai/v1/chat/completions'

// ── Groq helper ───────────────────────────────────────────────

async function groq(key: string, body: object): Promise<Response> {
  return fetch(API_URL, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(body),
  })
}

// ── Context builder ───────────────────────────────────────────

function buildContext(d: {
  crop_type: string
  location?: string
  weather?: { temp_c: number; humidity: number; condition: string; description: string }
  commodity_price_trend?: string
  farm_details?: { name: string; acreage: number; soil_type: string; irrigation_type: string }
}) {
  const weather = d.weather
    ? `${d.weather.temp_c}°C, ${d.weather.humidity}% humidity, ${d.weather.condition} (${d.weather.description})`
    : 'Weather data unavailable'

  const farm = d.farm_details
    ? `Farm: ${d.farm_details.name}, ${d.farm_details.acreage} acres, ${d.farm_details.soil_type} soil, ${d.farm_details.irrigation_type} irrigation`
    : 'Farm details not provided'

  return { weather, farm, price: d.commodity_price_trend ?? 'Commodity price data unavailable' }
}

// ── Main ──────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const GROQ_KEY            = Deno.env.get('GROQ_API_KEY')             ?? ''
  const SUPABASE_URL        = Deno.env.get('SUPABASE_URL')             ?? ''
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  try {
    const body = await req.json() as {
      mode:                  'advisory' | 'chat' | 'investor'
      crop_type:             string
      location?:             string
      weather?:              { temp_c: number; humidity: number; condition: string; description: string }
      commodity_price_trend?: string
      farm_details?:         { name: string; acreage: number; soil_type: string; irrigation_type: string }
      message?:              string
      chat_history?:         Array<{ role: 'user' | 'assistant'; content: string }>
      farmer_id?:            string
      farm_id?:              string
      listing_details?:      { funding_goal: number; amount_raised: number; expected_return: number; tokens_sold: number; total_tokens: number }
    }

    const { mode, crop_type, location, weather, commodity_price_trend, farm_details,
            message, chat_history, farmer_id, farm_id, listing_details } = body
    const ctx = buildContext({ crop_type, location, weather, commodity_price_trend, farm_details })

    // ── ADVISORY ─────────────────────────────────────────
    if (mode === 'advisory') {
      const userPrompt = `You are an expert agricultural advisor for smallholder farmers in Africa and Asia. Given the following data: Crop: ${crop_type}. Location: ${location ?? 'Not specified'}. Weather: ${ctx.weather}. Market trend: ${ctx.price}. ${ctx.farm}. Provide a concise 3-point advisory covering: (1) current growing conditions, (2) market outlook for this crop, (3) one specific action the farmer should take this week. Respond in plain text, no markdown, under 150 words.`

      const res = await groq(GROQ_KEY, {
        model:      MODEL,
        max_tokens: 400,
        messages:   [{ role: 'user', content: userPrompt }],
      })

      if (!res.ok) { const t = await res.text(); throw new Error(`Groq ${res.status}: ${t}`) }
      const json = await res.json()
      const advisory: string = json.choices?.[0]?.message?.content ?? ''

      return new Response(
        JSON.stringify({ advisory }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } },
      )
    }

    // ── CHAT (streaming) ──────────────────────────────────
    if (mode === 'chat') {
      // Rate limit: max 10 messages per farmer per day
      if (farmer_id) {
        const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        const today = new Date().toISOString().split('T')[0]
        const { count } = await admin
          .from('farm_notes')
          .select('*', { count: 'exact', head: true })
          .eq('farmer_id', farmer_id)
          .eq('note_type', 'advisory_chat')
          .gte('created_at', `${today}T00:00:00.000Z`)

        if ((count ?? 0) >= 10) {
          return new Response(
            JSON.stringify({ error: 'Daily message limit reached. You can send 10 advisory messages per day.' }),
            { status: 429, headers: { ...CORS, 'Content-Type': 'application/json' } },
          )
        }

        // Persist chat message to farm_notes for rate limiting
        if (farm_id && message) {
          await admin.from('farm_notes').insert({
            farm_id,
            farmer_id,
            note:      message,
            note_type: 'advisory_chat',
            photo_url: null,
          })
        }
      }

      const systemPrompt = `You are an expert agricultural advisor for smallholder farmers in Africa and Asia. Context — Crop: ${crop_type}. Location: ${location ?? 'Not specified'}. ${ctx.weather}. ${ctx.farm}. Answer the farmer's question concisely and practically. Keep responses under 100 words. Plain text only, no markdown.`

      const messages = [
        { role: 'system', content: systemPrompt },
        ...(chat_history ?? []),
        { role: 'user', content: message ?? '' },
      ]

      const groqRes = await groq(GROQ_KEY, {
        model:      MODEL,
        max_tokens: 250,
        messages,
        stream:     true,
      })

      if (!groqRes.ok) { const t = await groqRes.text(); throw new Error(`Groq ${groqRes.status}: ${t}`) }

      const forward = new ReadableStream({
        async start(ctrl) {
          const reader  = groqRes.body!.getReader()
          const decoder = new TextDecoder()
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              const lines = decoder.decode(value, { stream: true }).split('\n')
              for (const line of lines) {
                if (!line.startsWith('data: ')) continue
                const payload = line.slice(6).trim()
                if (!payload || payload === '[DONE]') {
                  if (payload === '[DONE]') {
                    ctrl.enqueue(new TextEncoder().encode(
                      `data: ${JSON.stringify({ done: true })}\n\n`,
                    ))
                  }
                  continue
                }
                try {
                  const evt = JSON.parse(payload)
                  const text = evt.choices?.[0]?.delta?.content
                  if (text) {
                    ctrl.enqueue(new TextEncoder().encode(
                      `data: ${JSON.stringify({ text })}\n\n`,
                    ))
                  }
                } catch { /* skip malformed */ }
              }
            }
          } finally {
            ctrl.close()
          }
        },
      })

      return new Response(forward, {
        headers: {
          ...CORS,
          'Content-Type':      'text/event-stream',
          'Cache-Control':     'no-cache',
          'X-Accel-Buffering': 'no',
        },
      })
    }

    // ── INVESTOR ──────────────────────────────────────────
    if (mode === 'investor') {
      const fundingCtx = listing_details
        ? `Funding: $${listing_details.amount_raised.toFixed(0)} of $${listing_details.funding_goal.toFixed(0)} raised (${Math.round((listing_details.tokens_sold / listing_details.total_tokens) * 100)}% funded). Expected return: ${listing_details.expected_return}%.`
        : ''

      const userPrompt = `You are a crop investment analyst. Should an investor buy ${crop_type} tokens right now? Context: Location: ${location ?? 'Not specified'}. Market trend: ${ctx.price}. Weather: ${ctx.weather}. ${fundingCtx} Start your response with exactly one word — "Favorable", "Neutral", or "Caution" — then one sentence of explanation. Maximum 30 words total.`

      const res = await groq(GROQ_KEY, {
        model:      MODEL,
        max_tokens: 80,
        messages:   [{ role: 'user', content: userPrompt }],
      })

      if (!res.ok) { const t = await res.text(); throw new Error(`Groq ${res.status}: ${t}`) }
      const json = await res.json()
      const text  = (json.choices?.[0]?.message?.content ?? 'Neutral').trim()
      const first = text.split(/\s+/)[0]
      const signal = ['Favorable', 'Neutral', 'Caution'].includes(first) ? first : 'Neutral'
      const explanation = text.slice(first.length).trim().replace(/^[.,]/, '').trim()

      return new Response(
        JSON.stringify({ signal, explanation }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid mode' }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }
})
