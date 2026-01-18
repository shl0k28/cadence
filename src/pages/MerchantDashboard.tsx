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
    <Stack spacing={6}>
      <Flex align="center" justify="space-between" wrap="wrap" gap={4}>
        <Box>
          <Heading size="lg">Merchant dashboard</Heading>
          <Text color="tempo.muted">
            Create payment links and track settlement status.
          </Text>
        </Box>
        <HStack spacing={6}>
          <Box>
            <Text fontSize="xs" color="tempo.muted">
              Invoices
            </Text>
            <Text fontWeight="600">{invoices.length}</Text>
          </Box>
          <Box>
            <Text fontSize="xs" color="tempo.muted">
              Wallet
            </Text>
            <Text fontFamily="mono">{formatAddress(profile.address)}</Text>
          </Box>
        </HStack>
      </Flex>

      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
        <Surface p={5}>
          <Stack spacing={4}>
            <Heading size="sm">Seller profile</Heading>
            <Box>
              <Text fontSize="sm" mb={2}>
                Seller name
              </Text>
              <Input
                value={sellerName}
                onChange={(event) => setSellerName(event.target.value)}
                placeholder="Tempo Studio"
              />
            </Box>
            <Button variant="outline" onClick={handleSellerSave} disabled={savingSeller}>
              {savingSeller ? 'Saving…' : 'Save'}
            </Button>
          </Stack>
        </Surface>

        <Surface p={5}>
          <Stack spacing={4}>
            <Heading size="sm">Create invoice</Heading>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              <Box>
                <Text fontSize="sm" mb={2}>
                  Amount (USD)
                </Text>
                <Input
                  value={amountUsd}
                  onChange={(event) => setAmountUsd(event.target.value)}
                  type="number"
                  min="0"
                  step="0.01"
                />
              </Box>
              <Box>
                <Text fontSize="sm" mb={2}>
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
            <Box>
              <Text fontSize="sm" mb={2}>
                Title
              </Text>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Tempo membership"
              />
            </Box>
            <Box>
              <Text fontSize="sm" mb={2}>
                Description
              </Text>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Monthly access to the studio."
              />
            </Box>
            <Box>
              <Text fontSize="sm" mb={2}>
                Invoice image
              </Text>
              <HStack spacing={2} mb={2}>
                <Button
                  size="xs"
                  variant={imageMode === 'url' ? 'solid' : 'outline'}
                  onClick={() => setImageMode('url')}
                >
                  Link
                </Button>
                <Button
                  size="xs"
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
                  {uploadError && <Text color="red.300">{uploadError}</Text>}
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
            <Box>
              <Text fontSize="sm" mb={2}>
                Invoice label (optional)
              </Text>
              <Input
                value={invoiceDisplayId}
                onChange={(event) => setInvoiceDisplayId(event.target.value)}
                placeholder="INV-2025-08-023"
              />
            </Box>
            {error && <Text color="red.300">{error}</Text>}
            <Button
              onClick={handleCreateInvoice}
              disabled={creating || !isSupabaseConfigured}
            >
              {creating ? 'Creating…' : 'Generate payment link'}
            </Button>
          </Stack>
        </Surface>
      </SimpleGrid>

      <Surface p={5}>
        <Stack spacing={4}>
          <Flex align="center" justify="space-between">
            <Heading size="sm">Recent invoices</Heading>
            {loading && (
              <Text fontSize="sm" color="tempo.muted">
                Refreshing…
              </Text>
            )}
          </Flex>
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
    </Stack>
  )
}

export default MerchantDashboard
