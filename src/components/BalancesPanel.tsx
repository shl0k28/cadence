import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Stack,
  Text,
} from '@chakra-ui/react'

import { Hooks } from 'tempo.ts/wagmi'

import type { TempoToken } from '../data/tokens'
import { formatTokenAmount } from '../lib/format'
import TokenLogo from './TokenLogo'
import { Inset, Surface } from './Surface'

export type FaucetControls = {
  onRequest: () => void
  isLoading: boolean
  message?: string | null
  error?: string | null
  disabled?: boolean
}

type BalancesPanelProps = {
  address: string | null
  title: string
  subtitle?: string
  tokens: TempoToken[]
  faucetControls?: FaucetControls
}

const BalanceRow = ({
  token,
  address,
}: {
  token: TempoToken
  address: `0x${string}`
}) => {
  const { data, isLoading } = Hooks.token.useGetBalance({
    account: address,
    token: token.address,
  })
  const balance =
    data !== undefined ? formatTokenAmount(data, token.decimals) : '0'

  return (
    <Inset px={4} py={3}>
      <Flex align="center" justify="space-between">
        <HStack spacing={3}>
          <TokenLogo token={token} boxSize="40px" />
          <Box>
            <Text fontWeight="600">{token.symbol}</Text>
            <Text fontSize="xs" color="tempo.muted">
              {token.name}
            </Text>
          </Box>
        </HStack>
        <HStack spacing={2}>
          <Text fontWeight="600">
            {isLoading ? 'Loading…' : balance}
          </Text>
          {token.faucet && (
            <Badge
              borderRadius="999px"
              bg="transparent"
              border="1px solid"
              borderColor="tempo.border"
              color="tempo.muted"
              fontSize="10px"
              letterSpacing="0.08em"
            >
              faucet
            </Badge>
          )}
        </HStack>
      </Flex>
    </Inset>
  )
}

const BalancesPanel = ({
  address,
  title,
  subtitle,
  tokens,
  faucetControls,
}: BalancesPanelProps) => (
  <Surface p={5}>
    <Stack spacing={4}>
      <Box>
        <Heading size="sm">{title}</Heading>
        {subtitle && (
          <Text fontSize="sm" color="tempo.muted">
            {subtitle}
          </Text>
        )}
      </Box>
      {!address && (
        <Text fontSize="sm" color="tempo.muted">
          Connect to view balances.
        </Text>
      )}
      {address && (
        <Stack spacing={3}>
          {tokens.map((token) => (
            <BalanceRow
              key={token.address}
              token={token}
              address={address as `0x${string}`}
            />
          ))}
          {faucetControls && tokens.some((token) => token.faucet) && (
            <Stack spacing={1}>
              <Button
                variant="outline"
                size="sm"
                onClick={faucetControls.onRequest}
                disabled={
                  faucetControls.disabled || faucetControls.isLoading
                }
              >
                {faucetControls.isLoading ? 'Requesting faucet…' : 'Get test tokens'}
              </Button>
              {faucetControls.error && (
                <Text fontSize="sm" color="red.300">
                  {faucetControls.error}
                </Text>
              )}
              {!faucetControls.error && faucetControls.message && (
                <Text fontSize="sm" color="tempo.muted">
                  {faucetControls.message}
                </Text>
              )}
            </Stack>
          )}
        </Stack>
      )}
    </Stack>
  </Surface>
)

export default BalancesPanel
