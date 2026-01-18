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

  if (loading) {
    return (
      <Surface p={{ base: 6, md: 8 }}>
        <Text color="tempo.muted">Loading invoice…</Text>
      </Surface>
    )
  }

  if (error) {
    return (
      <Surface p={{ base: 6, md: 8 }}>
        <Text color="tempo.error">{error}</Text>
      </Surface>
    )
  }

  if (!invoice) {
    return null
  }

  return (
    <Stack spacing={8}>
      {/* Main Invoice Card - Stripe-style layout */}
      <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={6}>
        {/* Left Column - Invoice Details */}
        <GridItem>
          <Surface p={{ base: 6, md: 8 }}>
            <Stack spacing={6}>
              {/* Header Section */}
              <Flex align="flex-start" justify="space-between" wrap="wrap" gap={4}>
                <Box flex="1" minW="200px">
                  <Heading size="xl" mb={2}>{invoice.title}</Heading>
                  {invoice.invoice_display_id && (
                    <Text fontSize="sm" color="tempo.muted" fontFamily="mono">
                      {invoice.invoice_display_id}
                    </Text>
                  )}
                  {!invoice.invoice_display_id && (
                    <Text fontSize="sm" color="tempo.muted" fontFamily="mono">
                      {invoice.id.slice(0, 8)}...
                    </Text>
                  )}
                </Box>
                <Badge 
                  bg={
                    invoice.status === 'paid' 
                      ? 'tempo.success' 
                      : invoice.status === 'open' 
                      ? 'tempo.accent' 
                      : 'tempo.panelStrong'
                  }
                  color={invoice.status === 'paid' ? '#0d0d0d' : 'tempo.text'}
                  px={4}
                  py={1.5}
                  borderRadius="6px"
                  fontSize="sm"
                  fontWeight="600"
                  textTransform="uppercase"
                  letterSpacing="0.05em"
                >
                  {invoice.status}
                </Badge>
              </Flex>

              {/* Divider */}
              <Box h="1px" bg="tempo.border" />

              {/* Amount Section - Prominent */}
              <Box>
                <Text fontSize="xs" fontWeight="600" color="tempo.muted" mb={2} textTransform="uppercase" letterSpacing="0.05em">
                  Amount Due
                </Text>
                <HStack spacing={3} align="baseline">
                  <Text fontWeight="700" fontSize="3xl">
                    ${Number(invoice.amount_usd).toFixed(2)}
                  </Text>
                  {invoiceToken && (
                    <HStack spacing={2} align="center">
                      <TokenLogo token={invoiceToken} boxSize="24px" />
                      <Text fontSize="lg" color="tempo.muted" fontWeight="500">
                        {invoiceToken.symbol}
                      </Text>
                    </HStack>
                  )}
                </HStack>
              </Box>

              {/* Divider */}
              <Box h="1px" bg="tempo.border" />

              {/* Invoice Details Grid */}
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                <Box>
                  <Text fontSize="xs" fontWeight="600" color="tempo.muted" mb={3} textTransform="uppercase" letterSpacing="0.05em">
                    Bill From
                  </Text>
                  <Text fontWeight="600" mb={1}>
                    {merchant?.seller_name ?? 'Tempo merchant'}
                  </Text>
                  {merchant && (
                    <Text fontSize="sm" color="tempo.muted" fontFamily="mono">
                      {formatAddress(merchant.address)}
                    </Text>
                  )}
                </Box>
                
                <Box>
                  <Text fontSize="xs" fontWeight="600" color="tempo.muted" mb={3} textTransform="uppercase" letterSpacing="0.05em">
                    Invoice Details
                  </Text>
                  <Stack spacing={2}>
                    <Flex justify="space-between">
                      <Text fontSize="sm" color="tempo.muted">Invoice ID</Text>
                      <Text fontSize="sm" fontFamily="mono" fontWeight="500">
                        {invoice.invoice_display_id ?? invoice.id.slice(0, 12)}...
                      </Text>
                    </Flex>
                    {invoice.paid_at && (
                      <Flex justify="space-between">
                        <Text fontSize="sm" color="tempo.muted">Paid on</Text>
                        <Text fontSize="sm" fontWeight="500">
                          {new Date(invoice.paid_at).toLocaleDateString()}
                        </Text>
                      </Flex>
                    )}
                    {invoice.paid_tx_hash && (
                      <Flex justify="space-between" align="center">
                        <Text fontSize="sm" color="tempo.muted">Transaction</Text>
                        {explorerBaseUrl ? (
                          <Button
                            as="a"
                            href={`${explorerBaseUrl}/tx/${invoice.paid_tx_hash}`}
                            target="_blank"
                            rel="noreferrer"
                            variant="link"
                            color="tempo.accent"
                            fontSize="sm"
                            fontWeight="500"
                            p={0}
                            minW="auto"
                          >
                            View on explorer
                          </Button>
                        ) : (
                          <Text fontSize="sm" fontFamily="mono">
                            {invoice.paid_tx_hash.slice(0, 10)}...
                          </Text>
                        )}
                      </Flex>
                    )}
                  </Stack>
                </Box>
              </SimpleGrid>

              {/* Invoice Image */}
              {invoice.image_url && (
                <>
                  <Box h="1px" bg="tempo.border" />
                  <Box borderRadius="12px" overflow="hidden">
                    <img 
                      src={invoice.image_url} 
                      alt={invoice.title}
                      style={{ width: '100%', maxHeight: '400px', objectFit: 'cover' }}
                    />
                  </Box>
                </>
              )}

              {/* Description */}
              {invoice.description && (
                <>
                  <Box h="1px" bg="tempo.border" />
                  <Box>
                    <Text fontSize="xs" fontWeight="600" color="tempo.muted" mb={2} textTransform="uppercase" letterSpacing="0.05em">
                      Description
                    </Text>
                    <Text color="tempo.text" lineHeight="1.6">
                      {invoice.description}
                    </Text>
                  </Box>
                </>
              )}
            </Stack>
          </Surface>
        </GridItem>

        {/* Right Column - Payment Section */}
        <GridItem>
          <Box position={{ lg: 'sticky' }} top={{ lg: 6 }}>
            <Surface p={6}>
              <Stack spacing={4}>
                <Heading size="md" mb={2}>Pay invoice</Heading>
                
                {!isConnected && (
                  <Stack spacing={3}>
                    <Text fontSize="sm" color="tempo.muted">
                      Connect your wallet to pay this invoice.
                    </Text>
                    <Button
                      onClick={() => connect.connect({ connector })}
                      disabled={!isSupabaseConfigured}
                      size="lg"
                      width="100%"
                    >
                      Sign in to pay
                    </Button>
                  </Stack>
                )}

                {isConnected && invoice?.status === 'paid' && (
                  <Stack spacing={3} align="center" py={4}>
                    <Badge 
                      bg="tempo.success" 
                      color="#0d0d0d"
                      px={4}
                      py={2}
                      borderRadius="6px"
                      fontSize="sm"
                      fontWeight="600"
                    >
                      ✓ Paid
                    </Badge>
                    <Text fontSize="sm" color="tempo.muted" textAlign="center">
                      This invoice has been paid.
                    </Text>
                    {invoice.paid_tx_hash && explorerBaseUrl && (
                      <Button
                        as="a"
                        href={`${explorerBaseUrl}/tx/${invoice.paid_tx_hash}`}
                        target="_blank"
                        rel="noreferrer"
                        variant="outline"
                        size="sm"
                      >
                        View transaction
                      </Button>
                    )}
                  </Stack>
                )}

                {isConnected && invoice?.status !== 'paid' && (
                  <Stack spacing={4}>
                    {/* Payment Summary */}
                    <Inset p={4}>
                      <Stack spacing={3}>
                        <Flex justify="space-between" align="center">
                          <Text fontSize="sm" color="tempo.muted">Amount</Text>
                          <Text fontWeight="600" fontSize="lg">
                            ${Number(invoice.amount_usd).toFixed(2)}
                          </Text>
                        </Flex>
                        {invoiceToken && (
                          <Flex justify="space-between" align="center">
                            <Text fontSize="sm" color="tempo.muted">Settle in</Text>
                            <HStack spacing={2}>
                              <TokenLogo token={invoiceToken} boxSize="20px" />
                              <Text fontWeight="500">{invoiceToken.symbol}</Text>
                            </HStack>
                          </Flex>
                        )}
                        {needsSwap && payToken && quoteAmountIn && (
                          <Box pt={2} borderTop="1px solid" borderColor="tempo.border">
                            <Text fontSize="xs" color="tempo.muted" mb={1}>
                              Paying with {payToken.symbol}
                            </Text>
                            <Text fontSize="sm" fontWeight="500">
                              ≈ {Number(quoteAmountIn) / Number(10n ** BigInt(payToken.decimals ?? 6))} {payToken.symbol}
                            </Text>
                          </Box>
                        )}
                      </Stack>
                    </Inset>

                    {/* Token Selection */}
                    {payToken && (
                      <Box>
                        <HStack justify="space-between" align="center" mb={2}>
                          <Text fontSize="sm" fontWeight="500">Payment method</Text>
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => setShowTokenPicker((current) => !current)}
                          >
                            {showTokenPicker ? 'Cancel' : 'Change'}
                          </Button>
                        </HStack>
                        {!showTokenPicker && (
                          <Inset p={3}>
                            <HStack spacing={3}>
                              <TokenLogo token={payToken} boxSize="32px" />
                              <Text fontWeight="500">{payToken.symbol}</Text>
                              {payTokenBalance !== undefined && (
                                <Text fontSize="sm" color="tempo.muted" ml="auto">
                                  Balance: {(Number(payTokenBalance) / Number(10n ** BigInt(payToken.decimals ?? 6))).toFixed(2)}
                                </Text>
                              )}
                            </HStack>
                          </Inset>
                        )}
                        {showTokenPicker && (
                          <Select
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
                        )}
                      </Box>
                    )}

                    {/* Pay Button */}
                    <Button
                      onClick={handlePay}
                      disabled={
                        isDemo ||
                        isPaying ||
                        (needsSwap && !quoteAmountIn) ||
                        (needsSwap && (balanceLoading || allowanceLoading))
                      }
                      size="lg"
                      width="100%"
                    >
                      {payingLabel}
                    </Button>

                    {payError && (
                      <Box p={3} bg="rgba(255,0,0,0.1)" borderRadius="6px" border="1px solid rgba(255,0,0,0.2)">
                        <Text color="tempo.error" fontSize="sm">{payError}</Text>
                      </Box>
                    )}

                    {isDemo && (
                      <Text fontSize="xs" color="tempo.muted" textAlign="center">
                        This is a demo invoice. Connect a real link to pay.
                      </Text>
                    )}
                  </Stack>
                )}
              </Stack>
            </Surface>
          </Box>
        </GridItem>
      </Grid>
    </Stack>
  )
}

export default InvoicePage
