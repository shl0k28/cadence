import { formatUnits } from 'viem'

export const formatAddress = (address: string) =>
  `${address.slice(0, 6)}…${address.slice(-4)}`

export const formatTokenAmount = (value: bigint, decimals: number) => {
  const formatted = formatUnits(value, decimals)
  const numeric = Number(formatted)
  if (!Number.isFinite(numeric)) return formatted
  return numeric.toLocaleString(undefined, { maximumFractionDigits: 4 })
}
