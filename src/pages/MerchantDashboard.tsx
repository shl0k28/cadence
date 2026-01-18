import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Input,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
} from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'

import BalancesPanel, { type FaucetControls } from '../components/BalancesPanel'
import TokenLogo from '../components/TokenLogo'
import { Inset, Surface } from '../components/Surface'
import type { TempoToken } from '../data/tokens'
import { formatAddress } from '../lib/format'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient'
import { uploadInvoiceImage } from '../lib/storage'
import type { Invoice, Profile } from '../types'

type MerchantDashboardProps = {
  address: string | null
  profile: Profile | null
  setProfile: (profile: Profile | null) => void
  tokens: TempoToken[]
  faucetControls: FaucetControls
}

const MerchantDashboard = ({
  address,
  profile,
  setProfile,
  tokens,
  faucetControls,
}: MerchantDashboardProps) => {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [invoiceDisplayId, setInvoiceDisplayId] = useState('')
  const [amountUsd, setAmountUsd] = useState('100')
  const [tokenAddress, setTokenAddress] = useState(
    tokens[1]?.address ?? tokens[0]?.address ?? ''
  )
  const [sellerName, setSellerName] = useState(profile?.seller_name ?? '')
  const [savingSeller, setSavingSeller] = useState(false)
  const [imageMode, setImageMode] = useState<'url' | 'upload'>('url')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const tokenMap = useMemo(() => {
    const map = new Map<string, TempoToken>()
    tokens.forEach((token) => map.set(token.address.toLowerCase(), token))
    return map
  }, [tokens])
  const selectedToken = tokenAddress
    ? tokenMap.get(tokenAddress.toLowerCase())
    : null

  useEffect(() => {
    setSellerName(profile?.seller_name ?? '')
  }, [profile?.seller_name])

  useEffect(() => {
    if (!profile?.id || !isSupabaseConfigured) return
    let active = true
    const loadInvoices = async () => {
      setLoading(true)
      setError(null)
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('merchant_id', profile.id)
        .order('created_at', { ascending: false })
      if (!active) return
      if (error) {
        setError(error.message)
      } else {
        setInvoices((data as Invoice[]) ?? [])
      }
      setLoading(false)
    }
    loadInvoices()
    return () => {
      active = false
    }
  }, [profile?.id])

  if (!profile) {
    return (
      <Surface p={6}>
        <Text color="tempo.muted">Connect and complete onboarding first.</Text>
      </Surface>
    )
  }

  if (!isSupabaseConfigured) {
    return (
      <Surface p={6}>
        <Text color="tempo.muted">Supabase is not configured yet.</Text>
      </Surface>
    )
  }

  if (profile.role !== 'merchant') {
    return (
      <Surface p={6}>
        <Text color="tempo.muted">Only merchants can access the dashboard.</Text>
      </Surface>
    )
  }

  const handleCreateInvoice = async () => {
    if (!profile || !address) return
    setCreating(true)
    setError(null)
    const supabase = getSupabaseClient()

    const token = tokens.find((item) => item.address === tokenAddress)
    if (!token) {
      setError('Select a token to receive.')
      setCreating(false)
      return
    }

    const { data, error } = await supabase
      .from('invoices')
      .insert({
        id: crypto.randomUUID(),
        merchant_id: profile.id,
        status: 'open',
        amount_usd: amountUsd,
        token_address: token.address,
        token_symbol: token.symbol,
        token_decimals: token.decimals,
        title: title.trim() || 'Tempo invoice',
        description: description.trim() || null,
        image_url: imageUrl.trim() || null,
        invoice_display_id: invoiceDisplayId.trim() || null,
      })
      .select('*')
      .single()

    if (error) {
      setError(error.message)
    } else if (data) {
      setInvoices((current) => [data as Invoice, ...current])
      setTitle('')
      setDescription('')
      setImageUrl('')
      setInvoiceDisplayId('')
    }
    setCreating(false)
  }

  const handleSellerSave = async () => {
    if (!profile) return
    setSavingSeller(true)
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('profiles')
      .update({ seller_name: sellerName.trim() || null })
      .eq('id', profile.id)
      .select('id,address,role,seller_name')
      .single()
    if (!error && data) {
      setProfile(data)
    }
    setSavingSeller(false)
  }

  const handleImageFileChange = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    if (!profile) return
    const file = event.target.files?.[0]
    if (!file) return
    if (!isSupabaseConfigured) {
      setUploadError('Supabase is not configured.')
      return
    }
    setUploadError(null)
    setUploadingImage(true)
    try {
      const publicUrl = await uploadInvoiceImage(file, profile.id)
      setImageUrl(publicUrl)
      setImageMode('upload')
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Upload failed. Try again.'
      )
    } finally {
      setUploadingImage(false)
      event.target.value = ''
    }
  }

  return (
    <Stack spacing={8}>
      <Flex align="center" justify="space-between" wrap="wrap" gap={4}>
        <Box>
          <Heading size="xl" mb={1}>Create invoice</Heading>
          <Text color="tempo.muted" fontSize="sm">
            Generate payment links and track settlement status.
          </Text>
        </Box>
        <HStack spacing={6}>
          <Box textAlign="right">
            <Text fontSize="xs" color="tempo.muted" mb={0.5}>
              Invoices
            </Text>
            <Text fontWeight="600" fontSize="lg">{invoices.length}</Text>
          </Box>
          <Box textAlign="right">
            <Text fontSize="xs" color="tempo.muted" mb={0.5}>
              Wallet
            </Text>
            <Text fontFamily="mono" fontSize="sm">{formatAddress(profile.address)}</Text>
          </Box>
        </HStack>
      </Flex>

      <Flex direction={{ base: 'column', lg: 'row' }} gap={6} align="flex-start">
        {/* Main Invoice Form - Takes up more space */}
        <Box flex="1" minW="0">
          <Surface p={{ base: 6, md: 8 }}>
            <Stack spacing={6}>
              {/* Amount and Token Section */}
              <Box>
                <Text fontSize="xs" fontWeight="600" color="tempo.muted" mb={3} textTransform="uppercase" letterSpacing="0.05em">
                  Payment Details
                </Text>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <Box>
                    <Text fontSize="sm" mb={2} fontWeight="500">
                      Amount (USD)
                    </Text>
                    <Input
                      value={amountUsd}
                      onChange={(event) => setAmountUsd(event.target.value)}
                      type="number"
                      min="0"
                      step="0.01"
                      size="lg"
                    />
                  </Box>
                  <Box>
                    <Text fontSize="sm" mb={2} fontWeight="500">
                      Receive token
                    </Text>
                    <HStack spacing={3}>
                      {selectedToken && <TokenLogo token={selectedToken} />}
                      <Select
                        flex="1"
                        value={tokenAddress}
                        onChange={(event) =>
                          setTokenAddress(event.target.value as `0x${string}`)
                        }
                        size="lg"
                      >
                        {tokens.map((token) => (
                          <option key={token.address} value={token.address}>
                            {token.symbol}
                            {token.faucet ? ' (faucet)' : ''}
                          </option>
                        ))}
                      </Select>
                    </HStack>
                  </Box>
                </SimpleGrid>
              </Box>

              {/* Divider */}
              <Box h="1px" bg="tempo.border" />

              {/* Invoice Details Section */}
              <Box>
                <Text fontSize="xs" fontWeight="600" color="tempo.muted" mb={3} textTransform="uppercase" letterSpacing="0.05em">
                  Invoice Details
                </Text>
                <Stack spacing={4}>
                  <Box>
                    <Text fontSize="sm" mb={2} fontWeight="500">
                      Title
                    </Text>
                    <Input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Tempo membership"
                      size="lg"
                    />
                  </Box>
                  <Box>
                    <Text fontSize="sm" mb={2} fontWeight="500">
                      Description
                    </Text>
                    <Textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Monthly access to the studio."
                      rows={4}
                    />
                  </Box>
                  <Box>
                    <Text fontSize="sm" mb={2} fontWeight="500">
                      Invoice label (optional)
                    </Text>
                    <Input
                      value={invoiceDisplayId}
                      onChange={(event) => setInvoiceDisplayId(event.target.value)}
                      placeholder="INV-2025-08-023"
                      size="lg"
                    />
                  </Box>
                </Stack>
              </Box>

              {/* Divider */}
              <Box h="1px" bg="tempo.border" />

              {/* Image Section */}
              <Box>
                <Text fontSize="xs" fontWeight="600" color="tempo.muted" mb={3} textTransform="uppercase" letterSpacing="0.05em">
                  Invoice Image (Optional)
                </Text>
                <HStack spacing={2} mb={3}>
                  <Button
                    size="sm"
                    variant={imageMode === 'url' ? 'solid' : 'outline'}
                    onClick={() => setImageMode('url')}
                  >
                    Link
                  </Button>
                  <Button
                    size="sm"
                    variant={imageMode === 'upload' ? 'solid' : 'outline'}
                    onClick={() => setImageMode('upload')}
                    disabled={!isSupabaseConfigured}
                  >
                    Upload
                  </Button>
                </HStack>
                {imageMode === 'url' ? (
                  <Input
                    value={imageUrl}
                    onChange={(event) => setImageUrl(event.target.value)}
                    placeholder="https://"
                    size="lg"
                  />
                ) : (
                  <Stack spacing={2}>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileChange}
                      disabled={!isSupabaseConfigured || uploadingImage}
                    />
                    {uploadingImage && (
                      <Text fontSize="sm" color="tempo.muted">
                        Uploading…
                      </Text>
                    )}
                    {uploadError && <Text color="red.300" fontSize="sm">{uploadError}</Text>}
                  </Stack>
                )}
                {imageUrl && (
                  <Inset mt={3} p={3}>
                    <Text fontSize="xs" color="tempo.muted" mb={2}>
                      Preview
                    </Text>
                    <Box borderRadius="12px" overflow="hidden">
                      <img
                        src={imageUrl}
                        alt="Invoice visual"
                        style={{ width: '100%', maxHeight: '220px', objectFit: 'cover' }}
                      />
                    </Box>
                  </Inset>
                )}
              </Box>

              {/* Error Message */}
              {error && (
                <Box p={3} bg="rgba(255,0,0,0.1)" borderRadius="6px" border="1px solid rgba(255,0,0,0.2)">
                  <Text color="red.300" fontSize="sm">{error}</Text>
                </Box>
              )}

              {/* Primary Action Button */}
              <Button
                onClick={handleCreateInvoice}
                disabled={creating || !isSupabaseConfigured}
                size="lg"
                width="100%"
              >
                {creating ? 'Creating…' : 'Generate payment link'}
              </Button>
            </Stack>
          </Surface>
        </Box>

        {/* Sidebar - Seller Profile */}
        <Box w={{ base: '100%', lg: '320px' }} flexShrink={0}>
          <Surface p={5}>
            <Stack spacing={4}>
              <Box>
                <Text fontSize="xs" fontWeight="600" color="tempo.muted" mb={3} textTransform="uppercase" letterSpacing="0.05em">
                  Seller Profile
                </Text>
                <Box>
                  <Text fontSize="sm" mb={2} fontWeight="500">
                    Seller name
                  </Text>
                  <Input
                    value={sellerName}
                    onChange={(event) => setSellerName(event.target.value)}
                    placeholder="Tempo Studio"
                    size="md"
                  />
                </Box>
              </Box>
              <Button 
                variant="outline" 
                onClick={handleSellerSave} 
                disabled={savingSeller}
                width="100%"
                size="md"
              >
                {savingSeller ? 'Saving…' : 'Save'}
              </Button>
            </Stack>
          </Surface>
        </Box>
      </Flex>

      <Box>
        <Flex align="center" justify="space-between" mb={4}>
          <Heading size="md">Recent invoices</Heading>
          {loading && (
            <Text fontSize="sm" color="tempo.muted">
              Refreshing…
            </Text>
          )}
        </Flex>
        <Surface p={5}>
          <Stack spacing={4}>
            {error && <Text color="red.300">{error}</Text>}
            {invoices.length === 0 && !loading && (
              <Text color="tempo.muted">No invoices created yet.</Text>
            )}
            <Stack spacing={3}>
              {invoices.map((invoice) => {
                const shareUrl = `${window.location.origin}/invoice/${invoice.id}`
                const invoiceToken = tokenMap.get(
                  invoice.token_address.toLowerCase()
                )
                return (
                  <Inset key={invoice.id} px={4} py={3}>
                    <Flex
                      align="center"
                      justify="space-between"
                      gap={4}
                      wrap="wrap"
                    >
                      <Box flex="1" minW="200px">
                        <Text fontWeight="600">{invoice.title}</Text>
                        <Text fontSize="sm" color="tempo.muted">
                          {invoice.invoice_display_id ?? invoice.id}
                        </Text>
                      </Box>
                      <Badge
                        bg="tempo.panelStrong"
                        color="tempo.text"
                        borderRadius="999px"
                        px={3}
                      >
                        {invoice.status}
                      </Badge>
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
                          ${Number(invoice.amount_usd).toFixed(2)}{' '}
                          {invoiceToken?.symbol ?? invoice.token_symbol}
                        </Text>
                      </HStack>
                      <HStack spacing={2}>
                        <Button
                          variant="outline"
                          size="sm"
                          as={RouterLink}
                          to={`/invoice/${invoice.id}`}
                        >
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigator.clipboard.writeText(shareUrl)}
                        >
                          Copy link
                        </Button>
                      </HStack>
                    </Flex>
                  </Inset>
                )
              })}
            </Stack>
          </Stack>
        </Surface>
      </Box>
    </Stack>
  )
}

export default MerchantDashboard
