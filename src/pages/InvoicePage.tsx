import { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  GridItem,
  Heading,
  HStack,
  Select,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react'
import { useParams } from 'react-router-dom'
import {
  useConnect,
  useConnectors,
  useConnection,
  useSendCallsSync,
} from 'wagmi'

import BalancesPanel, { type FaucetControls } from '../components/BalancesPanel'
import TokenLogo from '../components/TokenLogo'
import { Inset, Surface } from '../components/Surface'
import { config } from '../config/createConfig'
import { formatAddress } from '../lib/format'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient'
import { Hooks } from 'tempo.ts/wagmi'
import { Actions as TempoActions, Addresses } from 'tempo.ts/viem'
import { parseUnits, zeroAddress } from 'viem'
import type { TempoToken } from '../data/tokens'
import type { Invoice, Profile } from '../types'

type InvoicePageProps = {
  tokens: TempoToken[]
  faucetControls?: FaucetControls
}

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )

const InvoicePage = ({ tokens, faucetControls }: InvoicePageProps) => {
  const { invoiceId } = useParams()
  const { address, isConnected } = useConnection()
  const connect = useConnect()
  const [connector] = useConnectors()

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [merchant, setMerchant] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [payError, setPayError] = useState<string | null>(null)
  const [payTokenAddress, setPayTokenAddress] = useState<
    `0x${string}` | ''
  >(tokens[0]?.address ?? '')
  const [showTokenPicker, setShowTokenPicker] = useState(false)
  const isDemo = invoiceId === 'demo'

  const { mutateAsync: sendPayment, isPending } =
    Hooks.token.useTransferSync()
  const { mutateAsync: swapTokens, isPending: isSwapping } =
    Hooks.dex.useBuySync()
  const { mutateAsync: approveTokens, isPending: isApproving } =
    Hooks.token.useApproveSync()
  const { sendCallsSyncAsync, isPending: isBatching } = useSendCallsSync()

  const invoiceAmount = invoice
    ? parseUnits(String(invoice.amount_usd), invoice.token_decimals ?? 6)
    : null
  const feeToken =
    (config.chains[0] as { feeToken?: `0x${string}` | null })?.feeToken ??
    null
  const tokenMap = useMemo(() => {
    const map = new Map<string, TempoToken>()
    tokens.forEach((token) => map.set(token.address.toLowerCase(), token))
    return map
  }, [tokens])
  const payToken =
    (payTokenAddress &&
      tokenMap.get(payTokenAddress.toLowerCase())) ||
    null
  const invoiceToken =
    (invoice?.token_address &&
      tokenMap.get(invoice.token_address.toLowerCase())) ||
    null
  const needsSwap =
    Boolean(invoice?.token_address && payTokenAddress) &&
    payTokenAddress !== invoice?.token_address
  const shouldQuote =
    Boolean(needsSwap && payTokenAddress && invoice?.token_address) &&
    Boolean(invoiceAmount)
  const tokenInAddress = (payTokenAddress || zeroAddress) as `0x${string}`
  const tokenOutAddress = (invoice?.token_address || zeroAddress) as `0x${string}`
  const { data: quoteAmountIn } = Hooks.dex.useBuyQuote({
    tokenIn: tokenInAddress,
    tokenOut: tokenOutAddress,
    amountOut: invoiceAmount ?? 0n,
    query: { enabled: shouldQuote },
  })
  const maxAmountIn = quoteAmountIn
    ? quoteAmountIn + (quoteAmountIn * 100n) / 10000n
    : null
  const { data: payTokenBalance, isLoading: balanceLoading } =
    Hooks.token.useGetBalance({
      account: address ?? zeroAddress,
      token: payToken?.address ?? zeroAddress,
      query: { enabled: Boolean(address && payToken) },
    })
  const { data: allowance, isLoading: allowanceLoading } =
    Hooks.token.useGetAllowance({
      account: address ?? zeroAddress,
      spender: Addresses.stablecoinExchange,
      token: payToken?.address ?? zeroAddress,
      query: { enabled: Boolean(needsSwap && address && payToken) },
    })
  const needsApproval =
    Boolean(needsSwap && maxAmountIn && allowance !== undefined) &&
    allowance! < maxAmountIn!
  const isPaying = isPending || isSwapping || isApproving || isBatching
  const payLabel = 'Pay now'
  const payingLabel = isPaying ? 'Processing…' : payLabel
  const explorerBaseUrl =
    (
      config.chains[0] as {
        blockExplorers?: { default?: { url?: string | null } }
      }
    )?.blockExplorers?.default?.url ?? null

  useEffect(() => {
    if (!invoiceId) return
    if (isDemo) {
      const sampleToken = tokens[0]
      setInvoice({
        id: 'demo',
        merchant_id: 'demo-merchant',
        status: 'open',
        amount_usd: '120.50',
        token_address: sampleToken?.address ?? zeroAddress,
        token_symbol: sampleToken?.symbol ?? 'TOKEN',
        token_decimals: sampleToken?.decimals ?? 6,
        title: 'Sample Tempo invoice',
        description: 'Demo invoice for previewing the payment flow.',
        image_url: null,
        invoice_display_id: 'DEMO-001',
        customer_address: null,
        paid_tx_hash: null,
        paid_at: null,
      })
      setMerchant({
        id: 'demo-merchant',
        address: '0x20c0000000000000000000000000000000000000',
        role: 'merchant',
        seller_name: 'Demo merchant',
      })
      setLoading(false)
      setError(null)
      return
    }
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured.')
      return
    }
    if (!isUuid(invoiceId)) {
      setError('Invalid invoice link.')
      setLoading(false)
      return
    }
    let active = true
    const loadInvoice = async () => {
      setLoading(true)
      setError(null)
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .maybeSingle()
      if (!active) return
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
      if (!data) {
        setError('Invoice not found.')
        setLoading(false)
        return
      }
      setInvoice(data as Invoice)
      const { data: merchantData } = await supabase
        .from('profiles')
        .select('id,address,role,seller_name')
        .eq('id', data.merchant_id)
        .maybeSingle()
      if (active) setMerchant(merchantData ?? null)
      setLoading(false)
    }
    loadInvoice()
    return () => {
      active = false
    }
  }, [invoiceId])

  useEffect(() => {
    if (invoice?.token_address) {
      setPayTokenAddress(invoice.token_address as `0x${string}`)
    }
  }, [invoice?.token_address])

  const handlePay = async () => {
    if (!invoice || !merchant || !address || isDemo) return
    setPayError(null)
    try {
      const supabase = getSupabaseClient()
      const amount =
        invoiceAmount ??
        parseUnits(String(invoice.amount_usd), invoice.token_decimals ?? 6)
      if (needsSwap) {
        if (!quoteAmountIn || !maxAmountIn) {
          setPayError('Swap quote unavailable.')
          return
        }
        if (payTokenBalance !== undefined && payTokenBalance < maxAmountIn) {
          setPayError('Not enough balance to swap.')
          return
        }
        const calls = []
        if (needsApproval) {
          calls.push(
            TempoActions.token.approve.call({
              token: payTokenAddress as `0x${string}`,
              spender: Addresses.stablecoinExchange,
              amount: maxAmountIn,
            })
          )
        }
        calls.push(
          TempoActions.dex.buy.call({
            tokenIn: payTokenAddress as `0x${string}`,
            tokenOut: invoice.token_address as `0x${string}`,
            amountOut: amount,
            maxAmountIn,
          })
        )
        calls.push(
          TempoActions.token.transfer.call({
            token: invoice.token_address as `0x${string}`,
            to: merchant.address as `0x${string}`,
            amount,
          })
        )
        let txHash: string | null = null
        try {
          const status = await sendCallsSyncAsync({
            calls,
            forceAtomic: true,
          })
          if (status.status !== 'success') {
            setPayError('Batch transaction failed.')
            return
          }
          txHash = status.receipts?.[0]?.transactionHash ?? null
        } catch (err) {
          const message =
            err instanceof Error ? err.message.toLowerCase() : ''
          const name = err instanceof Error ? err.name : ''
          const unsupported =
            name === 'MethodNotFoundRpcError' ||
            name === 'MethodNotSupportedRpcError' ||
            name === 'AtomicityNotSupportedError' ||
            message.includes('wallet_sendcalls')
          if (!unsupported) {
            setPayError(err instanceof Error ? err.message : 'Payment failed.')
            return
          }
          if (needsApproval) {
            await approveTokens({
              token: payTokenAddress as `0x${string}`,
              spender: Addresses.stablecoinExchange,
              amount: maxAmountIn,
              feeToken: (feeToken ?? invoice.token_address) as `0x${string}`,
            })
          }
          await swapTokens({
            tokenIn: payTokenAddress as `0x${string}`,
            tokenOut: invoice.token_address as `0x${string}`,
            amountOut: amount,
            maxAmountIn,
            feeToken: (feeToken ?? invoice.token_address) as `0x${string}`,
          })
          const result = await sendPayment({
            amount,
            to: merchant.address as `0x${string}`,
            token: invoice.token_address as `0x${string}`,
            feeToken: invoice.token_address as `0x${string}`,
          })
          txHash = result.receipt.transactionHash
        }
        if (!txHash) {
          setPayError('Transaction confirmed without a hash.')
          return
        }
        const payer = address.toLowerCase()
        await supabase.from('payments').insert({
          invoice_id: invoice.id,
          status: 'confirmed',
          payer_address: payer,
          amount: invoice.amount_usd,
          token_address: invoice.token_address,
          tx_hash: txHash,
        })
        await supabase
          .from('invoices')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            paid_tx_hash: txHash,
            customer_address: payer,
          })
          .eq('id', invoice.id)
        setInvoice((current) =>
          current
            ? {
                ...current,
                status: 'paid',
                paid_tx_hash: txHash,
                paid_at: new Date().toISOString(),
                customer_address: payer,
              }
            : current
        )
        return
      }
      const result = await sendPayment({
        amount,
        to: merchant.address as `0x${string}`,
        token: invoice.token_address as `0x${string}`,
        feeToken: invoice.token_address as `0x${string}`,
      })
      const txHash = result.receipt.transactionHash
      const payer = address.toLowerCase()
      await supabase.from('payments').insert({
        invoice_id: invoice.id,
        status: 'confirmed',
        payer_address: payer,
        amount: invoice.amount_usd,
        token_address: invoice.token_address,
        tx_hash: txHash,
      })
      await supabase
        .from('invoices')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          paid_tx_hash: txHash,
          customer_address: payer,
        })
        .eq('id', invoice.id)
      setInvoice((current) =>
        current
          ? {
              ...current,
              status: 'paid',
              paid_tx_hash: txHash,
              paid_at: new Date().toISOString(),
              customer_address: payer,
            }
          : current
      )
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Payment failed.')
    }
  }

  return (
    <Stack spacing={6}>
      <Surface p={{ base: 5, md: 6 }}>
        <Stack spacing={4}>
          {loading && <Text color="tempo.muted">Loading invoice…</Text>}
          {error && <Text color="red.300">{error}</Text>}
          {invoice && (
            <Stack spacing={4}>
              <Flex align="center" justify="space-between" wrap="wrap" gap={3}>
                <Heading size="md">{invoice.title}</Heading>
                <Badge bg="tempo.panelStrong" color="tempo.text" px={3} py={1}>
                  {invoice.status}
                </Badge>
              </Flex>
              <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                <Inset p={3}>
                  <Text fontSize="xs" color="tempo.muted">
                    Amount
                  </Text>
                  <Text fontWeight="600" fontSize="lg">
                    ${Number(invoice.amount_usd).toFixed(2)}
                  </Text>
                </Inset>
                <Inset p={3}>
                  <Text fontSize="xs" color="tempo.muted">
                    Token
                  </Text>
                  <HStack spacing={2} align="center">
                    <TokenLogo
                      token={
                        invoiceToken ?? {
                          symbol: invoice.token_symbol,
                        }
                      }
                      boxSize="32px"
                    />
                    <Text fontWeight="600">
                      {invoiceToken?.symbol ?? invoice.token_symbol}
                    </Text>
                  </HStack>
                </Inset>
                <Inset p={3}>
                  <Text fontSize="xs" color="tempo.muted">
                    Invoice
                  </Text>
                  <Text fontWeight="600">
                    {invoice.invoice_display_id ?? invoice.id}
                  </Text>
                </Inset>
              </SimpleGrid>

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <Inset p={3}>
                  <Text fontSize="xs" color="tempo.muted">
                    Seller
                  </Text>
                  <Text fontWeight="600">
                    {merchant?.seller_name ?? 'Tempo merchant'}
                  </Text>
                  {merchant && (
                    <Text fontSize="sm" color="tempo.muted" fontFamily="mono">
                      {formatAddress(merchant.address)}
                    </Text>
                  )}
                </Inset>
                <Inset p={3}>
                  <Text fontSize="xs" color="tempo.muted">
                    Status
                  </Text>
                  <HStack spacing={2} align="center">
                    <Badge bg="tempo.panelStrong" color="tempo.text" px={2}>
                      {invoice.status}
                    </Badge>
                    {invoice.paid_tx_hash && explorerBaseUrl && (
                      <Button
                        as="a"
                        href={`${explorerBaseUrl}/tx/${invoice.paid_tx_hash}`}
                        target="_blank"
                        rel="noreferrer"
                        variant="link"
                        color="tempo.accent"
                        fontWeight="600"
                        p={0}
                        minW="auto"
                      >
                        Verify
                      </Button>
                    )}
                  </HStack>
                  {invoice.paid_tx_hash && !explorerBaseUrl && (
                    <Text fontFamily="mono" fontSize="sm">
                      {invoice.paid_tx_hash.slice(0, 14)}…
                    </Text>
                  )}
                </Inset>
              </SimpleGrid>

              {invoice.image_url && (
                <Inset p={3}>
                  <Box borderRadius="12px" overflow="hidden">
                    <img src={invoice.image_url} alt={invoice.title} />
                  </Box>
                </Inset>
              )}
              {invoice.description && (
                <Text color="tempo.muted">{invoice.description}</Text>
              )}
            </Stack>
          )}
        </Stack>
      </Surface>

      <Grid
        templateColumns={{ base: '1fr', lg: 'repeat(12, 1fr)' }}
        gap={6}
      >
        <GridItem colSpan={{ base: 12, lg: 7 }}>
          <Surface p={6}>
            <Stack spacing={4}>
              <Heading size="sm">Pay invoice</Heading>
              {!isConnected && (
                <Button
                  onClick={() => connect.connect({ connector })}
                  disabled={!isSupabaseConfigured}
                >
                  Sign in to pay
                </Button>
              )}
              {isConnected && invoice?.status !== 'paid' && (
                <Stack spacing={3}>
                  <Button
                    onClick={handlePay}
                    disabled={
                      isDemo ||
                      isPaying ||
                      (needsSwap && !quoteAmountIn) ||
                      (needsSwap && (balanceLoading || allowanceLoading))
                    }
                  >
                    {payingLabel}
                  </Button>
                  {isDemo && (
                    <Text fontSize="sm" color="tempo.muted">
                      This is a demo invoice. Connect a real link to pay.
                    </Text>
                  )}
                  {invoiceToken && (
                    <HStack spacing={2} align="center" color="tempo.muted">
                      <TokenLogo token={invoiceToken} boxSize="28px" />
                      <Text fontSize="sm">
                        We’ll settle in {invoiceToken.symbol} and handle swaps
                        automatically.
                      </Text>
                    </HStack>
                  )}
                  {payToken && (
                    <HStack justify="space-between" align="center">
                      <HStack spacing={2}>
                        <TokenLogo token={payToken} boxSize="28px" />
                        <Text fontSize="sm" color="tempo.muted">
                          Paying with {payToken.symbol}
                        </Text>
                      </HStack>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => setShowTokenPicker((current) => !current)}
                      >
                        Change
                      </Button>
                    </HStack>
                  )}
                  {showTokenPicker && (
                    <HStack spacing={3}>
                      {payToken && <TokenLogo token={payToken} boxSize="32px" />}
                      <Select
                        flex="1"
                        value={payTokenAddress}
                        onChange={(event) => {
                          setPayTokenAddress(event.target.value as `0x${string}`)
                          setShowTokenPicker(false)
                        }}
                        disabled={!invoice || !isConnected}
                      >
                        {tokens.map((token) => (
                          <option key={token.address} value={token.address}>
                            {token.symbol}
                          </option>
                        ))}
                      </Select>
                    </HStack>
                  )}
                </Stack>
              )}
              {invoice?.status === 'paid' && (
                <Button variant="outline" disabled>
                  Already paid
                </Button>
              )}
              {payError && <Text color="red.300">{payError}</Text>}
            </Stack>
          </Surface>
        </GridItem>
      </Grid>
    </Stack>
  )
}

export default InvoicePage
