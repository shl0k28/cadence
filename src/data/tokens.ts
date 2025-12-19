export type TempoToken = {
  symbol: string
  name: string
  address: `0x${string}`
  decimals: number
  faucet: boolean
}

export const ACCEPTED_TOKENS: TempoToken[] = [
  {
    symbol: 'pathUSD',
    name: 'pathUSD',
    address: '0x20c0000000000000000000000000000000000000',
    decimals: 6,
    faucet: false,
  },
  {
    symbol: 'AlphaUSD',
    name: 'AlphaUSD',
    address: '0x20c0000000000000000000000000000000000001',
    decimals: 6,
    faucet: true,
  },
  {
    symbol: 'BetaUSD',
    name: 'BetaUSD',
    address: '0x20c0000000000000000000000000000000000002',
    decimals: 6,
    faucet: true,
  },
  {
    symbol: 'ThetaUSD',
    name: 'ThetaUSD',
    address: '0x20c0000000000000000000000000000000000003',
    decimals: 6,
    faucet: true,
  },
]
