// ── CropTokenFactory ABI ──────────────────────────────────────
// Matches contracts/CropTokenFactory.sol deployed on BSC Testnet.

export const CROP_FACTORY_ABI = [
  // ── Write functions ─────────────────────────────────────────

  {
    name: 'createCropToken',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'cropType',         type: 'string'  },
      { name: 'totalSupply',      type: 'uint256' },
      { name: 'pricePerTokenWei', type: 'uint256' },
      { name: 'harvestDate',      type: 'uint256' },
    ],
    outputs: [{ name: 'tokenAddress', type: 'address' }],
  },

  {
    name: 'buyTokens',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'tokenAddress', type: 'address' },
      { name: 'amount',       type: 'uint256' },
    ],
    outputs: [],
  },

  {
    name: 'triggerPayout',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'tokenAddress', type: 'address' }],
    outputs: [],
  },

  // ── Read functions ──────────────────────────────────────────

  {
    name: 'getTokenInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenAddress', type: 'address' }],
    outputs: [
      { name: 'cropType',     type: 'string'  },
      { name: 'totalSupply',  type: 'uint256' },
      { name: 'pricePerToken',type: 'uint256' },
      { name: 'harvestDate',  type: 'uint256' },
      { name: 'isClosed',     type: 'bool'    },
    ],
  },

  {
    name: 'getAllTokens',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
  },

  // ── Events ──────────────────────────────────────────────────

  {
    name: 'CropTokenCreated',
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'tokenAddress',   type: 'address', indexed: true  },
      { name: 'farmer',         type: 'address', indexed: true  },
      { name: 'cropType',       type: 'string',  indexed: false },
      { name: 'totalSupply',    type: 'uint256', indexed: false },
      { name: 'pricePerTokenWei',type:'uint256', indexed: false },
      { name: 'harvestDate',    type: 'uint256', indexed: false },
    ],
  },

  {
    name: 'TokensPurchased',
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'tokenAddress', type: 'address', indexed: true  },
      { name: 'buyer',        type: 'address', indexed: true  },
      { name: 'amount',       type: 'uint256', indexed: false },
      { name: 'paid',         type: 'uint256', indexed: false },
    ],
  },
] as const

export type CropFactoryAbi = typeof CROP_FACTORY_ABI
