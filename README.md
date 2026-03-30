# AgriTok — Tokenized Crop Financing on BNB Chain

> Empowering smallholder farmers to raise funding by tokenizing future harvests as Real World Assets (RWA) on BNB Chain — and enabling global investors to fund them in exchange for profit share at harvest time.

Built for **RWA Demo Day — BNB Chain Track, HK Web3 Festival 2026**

---

## What It Does

AgriTok bridges the gap between smallholder farmers in emerging markets and global crypto investors. Farmers tokenize their future crop yields as ERC-20 tokens on BNB Chain. Investors buy those tokens to fund the growing season and receive their principal plus a share of harvest profits when the crop is sold.

**For Farmers**
- Register farms with GPS location and soil data
- Tokenize crops — mint ERC-20 tokens representing future yield on BSC Testnet
- Receive funding in BNB or fiat (Stripe)
- Submit harvest reports with photo proof
- Receive payouts automatically on harvest verification

**For Investors**
- Browse open crop listings with live commodity price data
- Invest with BNB/USDT on-chain or credit card via Stripe
- Track portfolio performance and funding progress in real time
- Receive profit share payouts at harvest

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS v3 |
| Backend / DB | Supabase (Auth + Postgres + Storage + Realtime) |
| Blockchain | BNB Chain (BSC Testnet) |
| Web3 | wagmi v2 + viem + RainbowKit |
| Payments | Stripe (fiat) + BNB/USDT on-chain |
| Maps | Mapbox GL JS |
| Weather | OpenWeatherMap API |
| Commodity Prices | World Bank Commodity Price API |
| AI Advisory | Claude (Anthropic) via Supabase Edge Functions |
| Email | Resend via Supabase Edge Functions |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project
- MetaMask or any WalletConnect-compatible wallet
- BSC Testnet BNB (get from [testnet faucet](https://testnet.bnbchain.org/faucet-smart))

### 1. Clone and install

```bash
git clone https://github.com/your-username/agritoken.git
cd agritoken
npm install
```

### 2. Environment variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

VITE_OPENWEATHER_API_KEY=your-openweathermap-key
VITE_MAPBOX_TOKEN=your-mapbox-token
VITE_UNSPLASH_ACCESS_KEY=your-unsplash-key

VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
VITE_CROP_FACTORY_ADDRESS=0xYourDeployedFactoryAddress
VITE_BSC_TESTNET_RPC=https://data-seed-prebsc-1-s1.binance.org:8545/
VITE_WALLETCONNECT_PROJECT_ID=your-walletconnect-project-id
```

### 3. Set up Supabase

Run the schema in your Supabase SQL editor:

```bash
# Copy and run in Supabase Dashboard > SQL Editor
supabase/schema.sql
supabase/rpc.sql
supabase/triggers.sql
```

Deploy edge functions:

```bash
supabase link --project-ref your-project-ref
supabase functions deploy
```

Set function secrets in Supabase Dashboard > Edge Functions > Secrets:

```
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY
EMAIL_FROM
CROP_FACTORY_ADDRESS
CROP_FACTORY_PRIVATE_KEY
BSC_TESTNET_RPC
ANTHROPIC_API_KEY
```

### 4. Run locally

```bash
npm run dev
```

App runs at `http://localhost:5173`

---

## Demo Walkthrough

### Farmer Flow

1. **Register as Farmer** — go to `/register`, choose Farmer, complete the 3-step onboarding (account, farm details, KYC upload)
2. **Dashboard** — land on the farmer dashboard; an onboarding modal guides you through each step
3. **Create Farm** — `/farmer/farms/new` — add farm name, location on map, acreage, soil type
4. **Tokenize a Crop** — `/farmer/listings/new` — select crop type, set token price, funding goal, harvest date; connect MetaMask and mint on BSC Testnet
5. **Track Funding** — watch the real-time funding bar fill as investors buy tokens
6. **Submit Harvest** — `/farmer/harvest/:id` — upload yield data and photos after harvest
7. **Receive Payout** — admin verifies the harvest report and triggers the smart contract payout

### Investor Flow

1. **Register as Investor** — go to `/register`, choose Investor; supports email/password or MetaMask wallet
2. **Browse Marketplace** — `/investor/marketplace` — filter by crop type, return %, funding progress, deadline
3. **View Listing Detail** — click any card to see full details: commodity price chart, weather data, farm location on map, AI market intelligence
4. **Invest** — select token amount, choose BNB (recommended, on-chain) or Card payment; confirm via MetaMask
5. **Track Portfolio** — `/investor/portfolio` — see all investments, funding status, expected payout dates
6. **Receive Payout** — when harvest is verified, tokens are redeemed and profit is sent to your wallet

### Admin Flow

1. **Login as Admin** — use admin credentials (role set in Supabase `profiles` table)
2. **Review KYC** — approve or reject farmer identity verification requests
3. **Verify Harvests** — review farmer-submitted harvest reports with photos
4. **Trigger Payouts** — call the smart contract payout function after harvest verification

---

## Smart Contract

The `CropTokenFactory` contract is deployed on BSC Testnet.

```solidity
// Key functions
function createCropToken(string cropType, uint256 totalSupply, uint256 pricePerTokenWei, uint256 harvestDate) external returns (address);
function buyTokens(address tokenAddress, uint256 amount) external payable;
function triggerPayout(address tokenAddress) external; // admin only
```

Contract address is stored in `VITE_CROP_FACTORY_ADDRESS`.

---

## Project Structure

```
src/
  components/       # Shared UI components
  pages/
    auth/           # Landing, Login, Register (Farmer/Investor)
    farmer/         # Farmer dashboard and all farmer pages
    investor/       # Investor dashboard, marketplace, portfolio
    admin/          # Admin panel
  lib/
    supabase/       # All database query functions
    api/            # External API integrations (weather, commodities, etc.)
  stores/           # Zustand global state
  types/            # TypeScript types
supabase/
  functions/        # Edge functions (payments, emails, payouts, AI)
  schema.sql        # Full database schema with RLS policies
```

---

## License

MIT
