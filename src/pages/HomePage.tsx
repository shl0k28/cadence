import { useEffect, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Heading,
  HStack,
  Input,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'

import { config } from '../config/createConfig'
import { upsertPasskeyCredential } from '../lib/passkey'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient'
import { formatAddress } from '../lib/format'
import type { Profile, Role } from '../types'
import { Inset, Surface } from '../components/Surface'

type HomePageProps = {
  address: string | null
  isConnected: boolean
  profile: Profile | null
  profileLoading: boolean
  profileError: string | null
  setProfile: (profile: Profile | null) => void
}

const HomePage = ({
  address,
  isConnected,
  profile,
  profileLoading,
  profileError,
  setProfile,
}: HomePageProps) => {
  const [role, setRole] = useState<Role>('merchant')
  const [sellerName, setSellerName] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (profile?.seller_name) setSellerName(profile.seller_name)
  }, [profile?.seller_name])

  const handleCreateProfile = async () => {
    if (!address) return
    if (!isSupabaseConfigured) {
      setSaveError('Supabase is not configured.')
      return
    }
    setSavingProfile(true)
    setSaveError(null)
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          address: address.toLowerCase(),
          role,
          seller_name: role === 'merchant' ? sellerName.trim() || null : null,
        },
        { onConflict: 'address' }
      )
      .select('id,address,role,seller_name')
      .single()
    if (error) {
      setSaveError(error.message)
      setSavingProfile(false)
      return
    }
    setProfile(data)
    await upsertPasskeyCredential(config.storage, data.id)
    setSavingProfile(false)
  }

  return (
    <Stack spacing={12}>
      <Surface
        p={{ base: 6, md: 10 }}
        bg="linear-gradient(160deg, rgba(56,207,255,0.14), transparent 45%), radial-gradient(circle at 20% 20%, rgba(255,255,255,0.05), transparent 35%), radial-gradient(circle at 80% 10%, rgba(100,255,215,0.08), transparent 30%)"
      >
        <Stack spacing={8} align="center" textAlign="center">
          <HStack spacing={3}>
            <Badge
              borderRadius="999px"
              px={3}
              py={1}
              bg="tempo.panelStrong"
              color="tempo.text"
            >
              Testnet
            </Badge>
            <Text color="tempo.muted" fontSize="sm">
              Cadence · Stablecoin invoicing on Tempo
            </Text>
          </HStack>
          <Stack spacing={4} maxW="720px">
            <Heading size="2xl">Search. Create. Settle.</Heading>
            <Text fontSize="lg" color="tempo.muted">
              Generate Tempo payment links, share instantly, and track on-chain status —
              same design language as the Tempo Explorer.
            </Text>
          </Stack>
          <Box w="100%" maxW="520px">
            <HStack
              as={Surface}
              px={3}
              py={2}
              borderRadius="12px"
              bg="tempo.bg"
              align="center"
              spacing={3}
              boxShadow="inset 0 0 0 1px rgba(255,255,255,0.06)"
            >
              <Input
                placeholder="Enter an address, invoice link, or token symbol…"
                bg="transparent"
                border="none"
                _focusVisible={{ boxShadow: 'none' }}
                pointerEvents="none"
              />
              <Button size="sm" variant="solid">
                View latest
              </Button>
            </HStack>
          </Box>
          <HStack spacing={4} wrap="wrap" justify="center" color="tempo.muted">
            <Text fontSize="sm">Try</Text>
            <HStack spacing={3} fontSize="sm">
              <RouterLink to="/merchant">
                <Text color="tempo.text" textDecoration="underline">
                  Dashboard
                </Text>
              </RouterLink>
              <Text>·</Text>
              <RouterLink to="/">
                <Text color="tempo.text" textDecoration="underline">
                  Create invoice
                </Text>
              </RouterLink>
              <Text>·</Text>
              <RouterLink to="/invoice/demo">
                <Text color="tempo.text" textDecoration="underline">
                  Sample invoice
                </Text>
              </RouterLink>
            </HStack>
          </HStack>
        </Stack>
      </Surface>

      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
        {[
          {
            title: 'On-chain first',
            copy: 'Instant settlement on Tempo testnet with swaps handled automatically.',
          },
          {
            title: 'Passkey-native',
            copy: 'Sign in with passkeys; no extensions required.',
          },
          {
            title: 'Explorer-aligned',
            copy: 'UI mirrors Tempo Explorer for a cohesive developer experience.',
          },
        ].map((item) => (
          <Surface key={item.title} p={5}>
            <Heading size="sm" mb={2}>
              {item.title}
            </Heading>
            <Text color="tempo.muted">{item.copy}</Text>
          </Surface>
        ))}
      </SimpleGrid>

      {!isConnected && (
        <Surface p={6}>
          <Stack spacing={4}>
            <Heading size="md">Get started</Heading>
            <Text color="tempo.muted">
              Create a passkey wallet to onboard in seconds.
            </Text>
            <Stack align="flex-start" spacing={2}>
              <Button disabled>Create passkey</Button>
              <Text fontSize="sm" color="tempo.muted">
                Use the header buttons to sign in.
              </Text>
            </Stack>
          </Stack>
        </Surface>
      )}

      {isConnected && (
        <Surface p={6}>
          <Stack spacing={4}>
            <Heading size="md">Account setup</Heading>
            {profileLoading && <Text color="tempo.muted">Loading profile…</Text>}
            {profileError && <Text color="red.300">{profileError}</Text>}
            {!profileLoading && !profile && (
              <Stack spacing={4}>
                <Text>Select how you want to use Tempo Pay.</Text>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  {(['merchant', 'customer'] as Role[]).map((item) => {
                    const active = role === item
                    return (
                      <Box
                        key={item}
                        as="button"
                        textAlign="left"
                        p={4}
                        borderRadius="12px"
                        bg="tempo.bg"
                        boxShadow={`inset 0 0 0 1px ${
                          active ? 'var(--chakra-colors-tempo-accent)' : 'rgba(255,255,255,0.06)'
                        }`}
                        transition="transform 0.2s ease"
                        _hover={{ transform: 'translateY(-2px)' }}
                        onClick={() => setRole(item)}
                      >
                        <Heading size="sm" mb={2}>
                          {item === 'merchant' ? 'Merchant' : 'Customer'}
                        </Heading>
                        <Text fontSize="sm" color="tempo.muted">
                          {item === 'merchant'
                            ? 'Create invoices and collect stablecoins.'
                            : 'Pay Tempo invoices with your passkey wallet.'}
                        </Text>
                      </Box>
                    )
                  })}
                </SimpleGrid>
                {role === 'merchant' && (
                  <Box>
                    <Text fontSize="sm" mb={2}>
                      Seller name
                    </Text>
                    <Input
                      value={sellerName}
                      onChange={(event) => setSellerName(event.target.value)}
                      placeholder="Studio Tempo"
                    />
                  </Box>
                )}
                {saveError && <Text color="red.300">{saveError}</Text>}
                <Button
                  onClick={handleCreateProfile}
                  disabled={!isSupabaseConfigured || savingProfile}
                >
                  {savingProfile ? 'Saving…' : 'Continue'}
                </Button>
              </Stack>
            )}
            {profile && (
              <Stack spacing={4}>
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                  <Box>
                    <Text fontSize="xs" color="tempo.muted">
                      Mode
                    </Text>
                    <Text fontWeight="600">{profile.role}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="tempo.muted">
                      Wallet
                    </Text>
                    <Text fontFamily="mono">
                      {formatAddress(profile.address)}
                    </Text>
                  </Box>
                  {profile.seller_name && (
                    <Box>
                      <Text fontSize="xs" color="tempo.muted">
                        Seller
                      </Text>
                      <Text fontWeight="600">{profile.seller_name}</Text>
                    </Box>
                  )}
                </SimpleGrid>
                {profile.role === 'merchant' ? (
                  <Button as={RouterLink} to="/merchant" width="fit-content">
                    Go to dashboard
                  </Button>
                ) : (
                  <Inset p={4}>
                    <Text fontSize="sm">
                      Paste any invoice link to pay with your passkey wallet.
                    </Text>
                  </Inset>
                )}
              </Stack>
            )}
          </Stack>
        </Surface>
      )}
    </Stack>
  )
}

export default HomePage
