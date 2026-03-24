import { useState, useEffect, useRef } from 'react'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { parseEventLogs } from 'viem'
import { parseEther } from 'viem'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { useAuth } from './useAuth'
import { CROP_FACTORY_ABI } from '../lib/contracts/abis'
import { FACTORY_ADDRESS, IS_DEMO } from '../lib/contracts/cropFactory'
import { createListing } from '../lib/supabase/listings'
import { updateListingFunding } from '../lib/supabase/listings'
import { createInvestment } from '../lib/supabase/investments'
import { createNotification } from '../lib/supabase/notifications'
import { supabase } from '../lib/supabase/client'
import type { CropListing } from '../types'

// ── Transaction state machine ──────────────────────────────────

export type TxStatus =
  | 'idle'
  | 'wallet'      // waiting for user to approve in MetaMask
  | 'submitted'   // tx on-chain, waiting for confirmations
  | 'confirmed'   // 3 block confirmations received
  | 'saving'      // writing to Supabase
  | 'done'
  | 'error'

// ── Error message parser ───────────────────────────────────────

function parseContractError(err: unknown): string {
  if (!(err instanceof Error)) return 'An unexpected error occurred'
  const msg = (err as { shortMessage?: string }).shortMessage ?? err.message
  if (msg.includes('User rejected') || msg.includes('user rejected'))
    return 'Transaction rejected in wallet'
  if (msg.includes('insufficient funds') || msg.includes('insufficient balance'))
    return 'Insufficient BNB balance for this transaction'
  if (msg.includes('execution reverted'))
    return 'Contract execution reverted — check your inputs'
  if (msg.includes('network') || msg.includes('disconnected'))
    return 'Network error — check your connection and try again'
  return msg.slice(0, 120)
}

// ── Demo mint simulation ───────────────────────────────────────

function fakeTxHash(): `0x${string}` {
  return ('0x' + Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('')) as `0x${string}`
}

// ── Create listing params ──────────────────────────────────────

export interface CreateListingParams {
  farmId:                string
  cropType:              string
  cropImageUrl:          string | null
  expectedYieldKg:       number
  pricePerTokenUsd:      number
  totalTokens:           number
  fundingGoalUsd:        number
  fundingDeadline:       string   // ISO string
  harvestDate:           string   // ISO string
  expectedReturnPercent: number
  description:           string
  soilFile:              File | null
  planFile:              File | null
  bnbPriceUsd:           number   // for wei conversion
  mintOnChain:           boolean
}

// ── useCreateAndSaveListing ────────────────────────────────────

export function useCreateAndSaveListing() {
  const { profile } = useAuth()
  const queryClient  = useQueryClient()
  const navigate     = useNavigate()

  const [status,   setStatus]   = useState<TxStatus>('idle')
  const [txHash,   setTxHash]   = useState<`0x${string}` | undefined>(undefined)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Hold form data across the async state machine
  const pendingRef = useRef<CreateListingParams | null>(null)
  const tokenAddrRef = useRef<string | null>(null)

  const { writeContractAsync } = useWriteContract()

  // Watch for 3 confirmations after tx is submitted
  const { data: receipt, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash:          txHash,
    confirmations: 3,
  })

  // When 3 confirmations arrive, extract token address and save to Supabase
  useEffect(() => {
    if (!isConfirmed || !receipt || status !== 'submitted' || !pendingRef.current) return
    const logs = parseEventLogs({
      abi:       CROP_FACTORY_ABI,
      logs:      receipt.logs,
      eventName: 'CropTokenCreated',
    })
    const tokenAddress = (logs[0]?.args as { tokenAddress?: string } | undefined)?.tokenAddress ?? null
    tokenAddrRef.current = tokenAddress
    void saveToSupabase(pendingRef.current, tokenAddress)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfirmed, receipt, status])

  // ── Upload helper (uses crop-images bucket) ──────────────────
  async function uploadDoc(file: File, docType: 'soil' | 'plan', userId: string): Promise<string | null> {
    try {
      const ext  = file.name.split('.').pop() ?? 'pdf'
      const path = `${userId}/docs/${docType}-${Date.now()}.${ext}`
      const { data, error } = await supabase.storage
        .from('crop-images')
        .upload(path, file, { upsert: true })
      if (error) return null
      return supabase.storage.from('crop-images').getPublicUrl(data.path).data.publicUrl
    } catch {
      return null
    }
  }

  // ── Save listing to Supabase ─────────────────────────────────
  async function saveToSupabase(data: CreateListingParams, tokenAddress: string | null) {
    if (!profile) return
    setStatus('saving')
    try {
      // Upload documents in parallel (best-effort)
      const [soilUrl] = await Promise.all([
        data.soilFile ? uploadDoc(data.soilFile, 'soil', profile.id) : Promise.resolve(null),
        data.planFile ? uploadDoc(data.planFile, 'plan', profile.id) : Promise.resolve(null),
      ])

      const listing = await createListing({
        farm_id:                 data.farmId,
        farmer_id:               profile.id,
        crop_type:               data.cropType,
        crop_image_url:          data.cropImageUrl,
        expected_yield_kg:       data.expectedYieldKg,
        price_per_token_usd:     data.pricePerTokenUsd,
        total_tokens:            data.totalTokens,
        tokens_sold:             0,
        funding_goal_usd:        data.fundingGoalUsd,
        amount_raised_usd:       0,
        funding_deadline:        data.fundingDeadline,
        harvest_date:            data.harvestDate,
        expected_return_percent: data.expectedReturnPercent,
        status:                  'open',
        token_contract_address:  tokenAddress,
        description:             data.description,
        // soil/plan docs stored separately; soilUrl available for future schema extension
        ...((soilUrl) ? {} : {}),
      })

      // Notify admins (best-effort, non-blocking)
      void supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .then(({ data: admins }) => {
          if (!admins?.length) return
          void Promise.allSettled(
            admins.map((a: { id: string }) =>
              createNotification({
                user_id: a.id,
                title:   'New crop listing submitted',
                message: `${profile.full_name ?? 'A farmer'} listed ${data.cropType} — goal $${data.fundingGoalUsd.toLocaleString()}`,
                type:    'system',
                read:    false,
              }),
            ),
          )
        })

      queryClient.invalidateQueries({ queryKey: ['farmer-listings', profile.id] })
      localStorage.removeItem('agritoken-listing-draft')
      setStatus('done')
      toast.success('Crop listing created successfully')
      navigate(`/farmer/listings/${listing.id}`)
    } catch (err) {
      setErrorMsg(parseContractError(err))
      setStatus('error')
    }
  }

  // ── Main entry point ─────────────────────────────────────────
  async function create(data: CreateListingParams) {
    if (!profile) { toast.error('Not authenticated'); return }

    setStatus('idle')
    setErrorMsg(null)
    setTxHash(undefined)
    tokenAddrRef.current = null
    pendingRef.current   = data

    // No blockchain minting — go straight to Supabase
    if (!data.mintOnChain) {
      await saveToSupabase(data, null)
      return
    }

    // Demo mode — no contract deployed
    if (IS_DEMO) {
      setStatus('wallet')
      await new Promise((r) => setTimeout(r, 600))
      const fakeHash = fakeTxHash()
      setTxHash(fakeHash)
      setStatus('submitted')
      await new Promise((r) => setTimeout(r, 2200))
      setStatus('confirmed')
      await saveToSupabase(data, fakeHash)
      return
    }

    // Real contract call
    try {
      setStatus('wallet')
      const priceInBnb = data.pricePerTokenUsd / (data.bnbPriceUsd || 600)
      const hash = await writeContractAsync({
        address:      FACTORY_ADDRESS,
        abi:          CROP_FACTORY_ABI,
        functionName: 'createCropToken',
        args: [
          data.cropType,
          BigInt(data.totalTokens),
          parseEther(priceInBnb.toFixed(18)),
          BigInt(Math.floor(new Date(data.harvestDate).getTime() / 1000)),
        ],
      })
      setTxHash(hash)
      setStatus('submitted')
      // useEffect above handles confirmed → saving → done
    } catch (err) {
      setErrorMsg(parseContractError(err))
      setStatus('error')
    }
  }

  function reset() {
    setStatus('idle')
    setErrorMsg(null)
    setTxHash(undefined)
    pendingRef.current   = null
    tokenAddrRef.current = null
  }

  return {
    create,
    reset,
    status,
    txHash,
    errorMsg,
    isPending: !['idle', 'done', 'error'].includes(status),
  }
}

// ── usePurchaseTokens ──────────────────────────────────────────

export interface PurchaseResult {
  txHash:      `0x${string}`
  tokenCount:  number
  amountUsd:   number
}

export function usePurchaseTokens() {
  const { profile }  = useAuth()
  const queryClient  = useQueryClient()

  const [status,   setStatus]   = useState<TxStatus>('idle')
  const [txHash,   setTxHash]   = useState<`0x${string}` | undefined>(undefined)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const pendingRef = useRef<{ listing: CropListing; tokenCount: number } | null>(null)

  const { writeContractAsync } = useWriteContract()

  const { isSuccess: isConfirmed, data: receipt } = useWaitForTransactionReceipt({
    hash:          txHash,
    confirmations: 3,
  })

  useEffect(() => {
    if (!isConfirmed || !receipt || status !== 'submitted' || !pendingRef.current) return
    void recordInvestment(
      pendingRef.current.listing,
      pendingRef.current.tokenCount,
      receipt.transactionHash,
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfirmed, receipt, status])

  async function recordInvestment(listing: CropListing, tokenCount: number, hash: `0x${string}`) {
    if (!profile) return
    setStatus('saving')
    try {
      await createInvestment({
        investor_id:       profile.id,
        listing_id:        listing.id,
        tokens_purchased:  tokenCount,
        amount_paid_usd:   tokenCount * listing.price_per_token_usd,
        payment_method:    'bnb',
        transaction_hash:  hash,
        status:            'confirmed',
      })
      await updateListingFunding(listing.id, tokenCount, tokenCount * listing.price_per_token_usd)
      queryClient.invalidateQueries({ queryKey: ['listing-investments', listing.id] })
      queryClient.invalidateQueries({ queryKey: ['investor-investments', profile.id] })
      queryClient.invalidateQueries({ queryKey: ['all-open-listings'] })
      setStatus('done')
      toast.success('Investment confirmed on BNB Chain')
    } catch {
      setErrorMsg('Investment confirmed on-chain but failed to save. Contact support with your tx hash.')
      setStatus('error')
    }
  }

  async function purchase(listing: CropListing, tokenCount: number, totalWei: bigint) {
    if (!profile) { toast.error('Please sign in to invest'); return }
    if (!listing.token_contract_address) {
      toast.error('This listing has no on-chain contract')
      return
    }

    setStatus('idle')
    setErrorMsg(null)
    setTxHash(undefined)
    pendingRef.current = { listing, tokenCount }

    try {
      setStatus('wallet')
      const hash = await writeContractAsync({
        address:      FACTORY_ADDRESS,
        abi:          CROP_FACTORY_ABI,
        functionName: 'buyTokens',
        args:         [listing.token_contract_address as `0x${string}`, BigInt(tokenCount)],
        value:        totalWei,
      })
      setTxHash(hash)
      setStatus('submitted')
    } catch (err) {
      setErrorMsg(parseContractError(err))
      setStatus('error')
    }
  }

  function reset() {
    setStatus('idle')
    setErrorMsg(null)
    setTxHash(undefined)
    pendingRef.current = null
  }

  return {
    purchase,
    reset,
    status,
    txHash,
    errorMsg,
    isPending: !['idle', 'done', 'error'].includes(status),
  }
}
