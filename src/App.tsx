import { useEffect, useMemo, useState } from 'react'
import { Box } from '@chakra-ui/react'
import { Route, Routes } from 'react-router-dom'
import {
  useConnect,
  useConnectors,
  useConnection,
  useDisconnect,
} from 'wagmi'

import HeaderBar from './components/HeaderBar'
import type { FaucetControls } from './components/BalancesPanel'
import { ACCEPTED_TOKENS } from './data/tokens'
import { config } from './config/createConfig'
import { formatAddress } from './lib/format'
import { upsertPasskeyCredential } from './lib/passkey'
import { getSupabaseClient, isSupabaseConfigured } from './lib/supabaseClient'
import { useTempoTokens } from './lib/tokenlist'
import HomePage from './pages/HomePage'
import InvoicePage from './pages/InvoicePage'
import MerchantDashboard from './pages/MerchantDashboard'
import type { Profile } from './types'
import { Hooks } from 'tempo.ts/wagmi'

const App = () => {
  const { address, isConnected } = useConnection()
  const connect = useConnect()
  const [connector] = useConnectors()
  const { disconnect } = useDisconnect()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  useEffect(() => {
    if (!isConnected || !address) {
      setProfile(null)
      return
    }
    if (!isSupabaseConfigured) {
      setProfileError('Supabase is not configured.')
      setProfile(null)
      return
    }

    let active = true
    const loadProfile = async () => {
      setProfileLoading(true)
      setProfileError(null)
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('profiles')
        .select('id,address,role,seller_name')
        .eq('address', address.toLowerCase())
        .maybeSingle()
      if (!active) return
      if (error) {
        setProfileError(error.message)
        setProfile(null)
      } else {
        setProfile(data ?? null)
      }
      setProfileLoading(false)
    }
    loadProfile()
    return () => {
      active = false
    }
  }, [address, isConnected])

  useEffect(() => {
    if (!isConnected || !address || !isSupabaseConfigured) return
    upsertPasskeyCredential(config.storage, profile?.id ?? null).catch(
      (error) => console.error(error)
    )
  }, [address, isConnected, profile?.id])

  const { tokens } = useTempoTokens(
    ACCEPTED_TOKENS,
    config.chains[0]?.id
  )
  const { mutateAsync: requestFaucet, isPending: isFaucetPending } =
    Hooks.faucet.useFundSync()
  const [faucetError, setFaucetError] = useState<string | null>(null)
  const [faucetMessage, setFaucetMessage] = useState<string | null>(null)

  const handleRequestFaucet = async () => {
    if (!address) {
      setFaucetError('Connect your wallet to request faucet tokens.')
      return
    }
    try {
      setFaucetError(null)
      setFaucetMessage(null)
      await requestFaucet({ account: address })
      setFaucetMessage('Faucet requested. Tokens should arrive shortly.')
    } catch (err) {
      setFaucetError(
        err instanceof Error ? err.message : 'Faucet request failed.'
      )
    }
  }

  const faucetControls: FaucetControls = {
    onRequest: handleRequestFaucet,
    isLoading: isFaucetPending,
    message: faucetMessage,
    error: faucetError,
    disabled: !address,
  }

  useEffect(() => {
    if (!address) {
      setFaucetError(null)
      setFaucetMessage(null)
    }
  }, [address])

  const shortAddress = useMemo(
    () => (address ? formatAddress(address) : ''),
    [address]
  )

  return (
    <Box minH="100vh" bg="tempo.bg">
      <HeaderBar
        address={address ?? null}
        isConnected={isConnected}
        profile={profile}
        tokens={tokens}
        faucetControls={faucetControls}
        onSignUp={() =>
          connect.connect({
            connector,
            withCapabilities: true,
            // @ts-ignore
            capabilities: { type: 'sign-up', label: 'Cadence' },
          })
        }
        onSignIn={() => connect.connect({ connector })}
        onSignOut={() => disconnect()}
        disabled={!isSupabaseConfigured}
        shortAddress={shortAddress}
      />

      <Box as="main" maxW="1200px" mx="auto" px={{ base: 6, lg: 8 }} py={12}>
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                address={address ?? null}
                isConnected={isConnected}
                profile={profile}
                profileLoading={profileLoading}
                profileError={profileError}
                setProfile={setProfile}
              />
            }
          />
          <Route
            path="/merchant"
            element={
              <MerchantDashboard
                address={address ?? null}
                profile={profile}
                setProfile={setProfile}
                tokens={tokens}
                faucetControls={faucetControls}
              />
            }
          />
          <Route
            path="/invoice/:invoiceId"
            element={
              <InvoicePage tokens={tokens} faucetControls={faucetControls} />
            }
          />
        </Routes>
      </Box>
    </Box>
  )
}

export default App
