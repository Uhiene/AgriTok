// CoinGecko — live BNB/USD price for on-chain price conversion

const BASE = import.meta.env.VITE_COINGECKO_API_KEY
  ? 'https://pro-api.coingecko.com/api/v3'
  : 'https://api.coingecko.com/api/v3'

interface SimplePriceResponse {
  binancecoin: { usd: number }
}

export async function getBnbPriceUsd(): Promise<number> {
  const url = `${BASE}/simple/price?ids=binancecoin&vs_currencies=usd`
  const headers: HeadersInit = {}
  if (import.meta.env.VITE_COINGECKO_API_KEY) {
    headers['x-cg-pro-api-key'] = import.meta.env.VITE_COINGECKO_API_KEY as string
  }

  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`)

  const data: SimplePriceResponse = await res.json()
  const price = data.binancecoin?.usd
  if (!price || price <= 0) throw new Error('Invalid BNB price from CoinGecko')
  return price
}
