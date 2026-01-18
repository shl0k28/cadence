import { useEffect, useMemo, useState } from 'react'

import type { TempoToken } from '../data/tokens'

type TokenListEntry = {
  address: string
  name?: string
  symbol?: string
  decimals?: number
  logo_uri?: string
  logoURI?: string
}

type TokenListResponse = {
  tokens?: TokenListEntry[]
}

const TOKENLIST_BASE_URL = 'https://tokenlist.tempo.xyz'
const DEFAULT_CHAIN_ID = 42429

const normalizeAddress = (value?: string | null) =>
  (value ?? '').toLowerCase()

const buildIconUrl = (address: string, chainId: number | string) =>
  `${TOKENLIST_BASE_URL}/icon/${chainId}/${address}`

const withIconFallback = (token: TempoToken, chainId: number): TempoToken => ({
  ...token,
  logoUri: token.logoUri ?? buildIconUrl(token.address, chainId),
})

const mergeTokensWithLogos = (
  defaults: TempoToken[],
  fetched: TokenListEntry[],
  chainId: number
): TempoToken[] =>
  defaults.map((token) => {
    const match = fetched.find(
      (item) =>
        normalizeAddress(item.address) === normalizeAddress(token.address) ||
        (item.symbol &&
          item.symbol.toLowerCase() === token.symbol.toLowerCase())
    )
    return {
      ...token,
      name: match?.name ?? token.name,
      symbol: match?.symbol ?? token.symbol,
      decimals: match?.decimals ?? token.decimals,
      logoUri:
        match?.logo_uri ??
        match?.logoURI ??
        token.logoUri ??
        buildIconUrl(match?.address ?? token.address, chainId),
    }
  })

export const useTempoTokens = (
  defaults: TempoToken[],
  chainId: number = DEFAULT_CHAIN_ID
) => {
  const [tokens, setTokens] = useState<TempoToken[]>(() =>
    defaults.map((token) => withIconFallback(token, chainId))
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const fetchTokenList = async () => {
      setLoading(true)
      try {
        const response = await fetch(
          `${TOKENLIST_BASE_URL}/list/${chainId}`
        )
        if (!response.ok) {
          throw new Error(`Tokenlist request failed (${response.status})`)
        }
        const data = (await response.json()) as TokenListResponse
        const merged = data.tokens
          ? mergeTokensWithLogos(defaults, data.tokens, chainId)
          : defaults
        const mergedWithIcons = merged.map((token) =>
          token.logoUri ? token : withIconFallback(token, chainId)
        )
        if (!cancelled) {
          setTokens(mergedWithIcons)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load token list.'
          )
          setTokens(defaults.map((token) => withIconFallback(token, chainId)))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchTokenList()
    return () => {
      cancelled = true
    }
  }, [chainId, defaults])

  const tokenMap = useMemo(() => {
    const map = new Map<string, TempoToken>()
    tokens.forEach((token) => map.set(normalizeAddress(token.address), token))
    return map
  }, [tokens])

  return { tokens, tokenMap, loading, error }
}
