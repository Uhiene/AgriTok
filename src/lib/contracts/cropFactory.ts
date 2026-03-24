import { useWriteContract, useReadContract } from 'wagmi'
import { parseEther } from 'viem'
import { CROP_FACTORY_ABI } from './abis'

export const FACTORY_ADDRESS = (
  import.meta.env.VITE_CROP_FACTORY_ADDRESS ?? ''
) as `0x${string}`

export const IS_DEMO = !import.meta.env.VITE_CROP_FACTORY_ADDRESS

// ── useCreateCropToken ─────────────────────────────────────────

export interface CreateCropTokenParams {
  cropType:          string
  totalSupply:       number   // whole tokens
  priceUsd:          number   // USD per token → converted to BNB wei at call time
  bnbPriceUsd:       number   // current BNB/USD rate (from CoinGecko)
  harvestDate:       Date
}

export function useCreateCropToken() {
  const { writeContractAsync, isPending, error, reset } = useWriteContract()

  async function createCropToken(params: CreateCropTokenParams): Promise<`0x${string}`> {
    const priceInBnb    = params.priceUsd / params.bnbPriceUsd
    const pricePerWei   = parseEther(priceInBnb.toFixed(18))
    const harvestTs     = BigInt(Math.floor(params.harvestDate.getTime() / 1000))

    return writeContractAsync({
      address:      FACTORY_ADDRESS,
      abi:          CROP_FACTORY_ABI,
      functionName: 'createCropToken',
      args: [
        params.cropType,
        BigInt(params.totalSupply),
        pricePerWei,
        harvestTs,
      ],
    })
  }

  return { createCropToken, isPending, error, reset }
}

// ── useBuyTokens ───────────────────────────────────────────────

export interface BuyTokensParams {
  tokenAddress: `0x${string}`
  amount:       number   // whole tokens to buy
  totalWei:     bigint   // exact BNB wei to send (read from getTokenInfo)
}

export function useBuyTokens() {
  const { writeContractAsync, isPending, error, reset } = useWriteContract()

  async function buyTokens(params: BuyTokensParams): Promise<`0x${string}`> {
    return writeContractAsync({
      address:      FACTORY_ADDRESS,
      abi:          CROP_FACTORY_ABI,
      functionName: 'buyTokens',
      args:         [params.tokenAddress, BigInt(params.amount)],
      value:        params.totalWei,
    })
  }

  return { buyTokens, isPending, error, reset }
}

// ── useTokenInfo ───────────────────────────────────────────────

export interface TokenInfo {
  cropType:     string
  totalSupply:  bigint
  pricePerToken:bigint   // wei per token
  harvestDate:  bigint   // unix ts
  isClosed:     boolean
}

export function useTokenInfo(tokenAddress: string | null) {
  const enabled = !!tokenAddress && !!FACTORY_ADDRESS && tokenAddress.startsWith('0x') && tokenAddress.length === 42

  const { data, isLoading, error, refetch } = useReadContract({
    address:      FACTORY_ADDRESS,
    abi:          CROP_FACTORY_ABI,
    functionName: 'getTokenInfo',
    args:         enabled ? [tokenAddress as `0x${string}`] : undefined,
    query:        { enabled, staleTime: 1000 * 60 * 2 },
  })

  const info: TokenInfo | null = data
    ? {
        cropType:      data[0],
        totalSupply:   data[1],
        pricePerToken: data[2],
        harvestDate:   data[3],
        isClosed:      data[4],
      }
    : null

  return { info, isLoading, error, refetch }
}
