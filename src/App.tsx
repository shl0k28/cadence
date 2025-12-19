import { useEffect, useMemo, useState } from 'react'
import { Link, Route, Routes, useParams } from 'react-router-dom'
import {
  useConnect,
  useConnectors,
  useConnection,
  useDisconnect,
  useSendCallsSync,
} from 'wagmi'

import { Hooks } from 'tempo.ts/wagmi'
import { Actions as TempoActions, Addresses } from 'tempo.ts/viem'
import { formatUnits, parseUnits, zeroAddress } from 'viem'

import './App.css'
import { ACCEPTED_TOKENS, type TempoToken } from './data/tokens'
import { config } from './config/createConfig'
import { upsertPasskeyCredential } from './lib/passkey'
import { getSupabaseClient, isSupabaseConfigured } from './lib/supabaseClient'

type Role = 'merchant' | 'customer'
type Profile = {
  id: string
  address: string
  role: Role
  seller_name: string | null
}
type InvoiceStatus = 'open' | 'paid' | 'void' | 'expired'
type Invoice = {
  id: string
  merchant_id: string
  status: InvoiceStatus
  amount_usd: string
  token_address: string
  token_symbol: string
  token_decimals: number
  title: string
  description: string | null
  image_url: string | null
  invoice_display_id: string | null
  customer_address: string | null
  paid_tx_hash: string | null
  paid_at: string | null
}

const formatAddress = (address: string) =>
  `${address.slice(0, 6)}…${address.slice(-4)}`

const formatTokenAmount = (value: bigint, decimals: number) => {
  const formatted = formatUnits(value, decimals)
  const numeric = Number(formatted)
  if (!Number.isFinite(numeric)) return formatted
  return numeric.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

const App = () => {
  const { address, isConnected } = useConnection()
  const connect = useConnect()
  const [connector] = useConnectors()
  const { disconnect } = useDisconnect()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  useEffect(() => {
    console.log(import.meta.env.VITE_SUPABASE_URL)
  }, [])

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

  const shortAddress = useMemo(
    () => (address ? formatAddress(address) : ''),
    [address]
  )

  return (
    <div className="app">
      <Header
        address={address ?? null}
        isConnected={isConnected}
        profile={profile}
        onSignUp={() =>
          connect.connect({
            connector,
            withCapabilities: true,
            // @ts-ignore
            capabilities: { type: 'sign-up', label: 'Tempo Pay' },
          })
        }
        onSignIn={() => connect.connect({ connector })}
        onSignOut={() => disconnect()}
        disabled={!isSupabaseConfigured}
        shortAddress={shortAddress}
      />

      <main className="main">
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
              />
            }
          />
          <Route path="/invoice/:invoiceId" element={<InvoicePage />} />
        </Routes>
      </main>
    </div>
  )
}

type HeaderProps = {
  address: string | null
  shortAddress: string
  isConnected: boolean
  profile: Profile | null
  disabled: boolean
  onSignUp: () => void
  onSignIn: () => void
  onSignOut: () => void
}

const Header = ({
  address,
  shortAddress,
  isConnected,
  profile,
  disabled,
  onSignUp,
  onSignIn,
  onSignOut,
}: HeaderProps) => (
  <header className="header">
    <Link to="/" className="brand">
      <span className="brand-mark">Tempo</span>
      <span className="brand-sub">Pay</span>
    </Link>
    <nav className="nav">
      {profile?.role === 'merchant' && (
        <Link to="/merchant" className="nav-link">
          Dashboard
        </Link>
      )}
    </nav>
    <div className="header-actions">
      {profile && <span className="pill">{profile.role}</span>}
      {isConnected && address ? (
        <>
          <span className="wallet-pill">{shortAddress}</span>
          <button className="btn ghost" onClick={onSignOut}>
            Sign out
          </button>
        </>
      ) : (
        <>
          <button className="btn ghost" onClick={onSignIn} disabled={disabled}>
            Sign in
          </button>
          <button className="btn primary" onClick={onSignUp} disabled={disabled}>
            Create passkey
          </button>
        </>
      )}
    </div>
  </header>
)

type BalancesPanelProps = {
  address: string | null
  title: string
  subtitle?: string
  className?: string
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
    <div className="balance-row">
      <div className="balance-token">
        <span className="balance-symbol">{token.symbol}</span>
        <span className="balance-meta">{token.name}</span>
      </div>
      <div className="balance-value">
        {isLoading ? 'Loading…' : balance}
        {token.faucet && <span className="token-tag">faucet</span>}
      </div>
    </div>
  )
}

const BalancesPanel = ({
  address,
  title,
  subtitle,
  className = 'balances-panel',
}: BalancesPanelProps) => (
  <div className={className}>
    <div className="balances-header">
      <div>
        <h3>{title}</h3>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
    </div>
    {!address && <p className="muted">Connect to view balances.</p>}
    {address && (
      <div className="balances-grid">
        {ACCEPTED_TOKENS.map((token) => (
          <BalanceRow
            key={token.address}
            token={token}
            address={address as `0x${string}`}
          />
        ))}
      </div>
    )}
  </div>
)

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
    <section className="hero">
      <div className="hero-copy">
        <h1>Merchant‑grade stablecoin checkout.</h1>
        <p>
          Create Tempo payment links, share them instantly, and settle in the
          stablecoin you choose.
        </p>
        {!isSupabaseConfigured && (
          <div className="callout warning">
            Add `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` to start.
          </div>
        )}
      </div>

      {!isConnected && (
        <div className="panel">
          <h2>Get started</h2>
          <p>Create a passkey wallet to onboard in seconds.</p>
          <div className="panel-actions">
            <button className="btn primary" disabled>
              Create passkey
            </button>
            <span className="hint">Use the header buttons to sign in.</span>
          </div>
        </div>
      )}

      {isConnected && (
        <div className="panel wide">
          <h2>Account setup</h2>
          {profileLoading && <p className="muted">Loading profile…</p>}
          {profileError && <p className="error">{profileError}</p>}
          {!profileLoading && !profile && (
            <>
              <p>Select how you want to use Tempo Pay.</p>
              <div className="role-grid">
                <button
                  className={`role-card ${role === 'merchant' ? 'active' : ''}`}
                  onClick={() => setRole('merchant')}
                >
                  <h3>Merchant</h3>
                  <p>Create invoices and collect stablecoins.</p>
                </button>
                <button
                  className={`role-card ${role === 'customer' ? 'active' : ''}`}
                  onClick={() => setRole('customer')}
                >
                  <h3>Customer</h3>
                  <p>Pay Tempo invoices with your passkey wallet.</p>
                </button>
              </div>
              {role === 'merchant' && (
                <label className="field">
                  Seller name
                  <input
                    value={sellerName}
                    onChange={(event) => setSellerName(event.target.value)}
                    placeholder="Studio Tempo"
                  />
                </label>
              )}
              {saveError && <p className="error">{saveError}</p>}
              <button
                className="btn primary"
                onClick={handleCreateProfile}
                disabled={!isSupabaseConfigured || savingProfile}
              >
                {savingProfile ? 'Saving…' : 'Continue'}
              </button>
            </>
          )}
          {profile && (
            <>
              <div className="summary">
                <div>
                  <span className="label">Mode</span>
                  <span className="value">{profile.role}</span>
                </div>
                <div>
                  <span className="label">Wallet</span>
                  <span className="value">{formatAddress(profile.address)}</span>
                </div>
                {profile.seller_name && (
                  <div>
                    <span className="label">Seller</span>
                    <span className="value">{profile.seller_name}</span>
                  </div>
                )}
              </div>
              {profile.role === 'merchant' ? (
                <Link to="/merchant" className="btn primary">
                  Go to dashboard
                </Link>
              ) : (
                <div className="callout">
                  Paste any invoice link to pay with your passkey wallet.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}

type MerchantDashboardProps = {
  address: string | null
  profile: Profile | null
  setProfile: (profile: Profile | null) => void
}

const MerchantDashboard = ({
  address,
  profile,
  setProfile,
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
    ACCEPTED_TOKENS[1]?.address ?? ACCEPTED_TOKENS[0]?.address ?? ''
  )
  const [sellerName, setSellerName] = useState(profile?.seller_name ?? '')
  const [savingSeller, setSavingSeller] = useState(false)

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
      <section className="section">
        <p className="muted">Connect and complete onboarding first.</p>
      </section>
    )
  }

  if (!isSupabaseConfigured) {
    return (
      <section className="section">
        <p className="muted">Supabase is not configured yet.</p>
      </section>
    )
  }

  if (profile.role !== 'merchant') {
    return (
      <section className="section">
        <p className="muted">Only merchants can access the dashboard.</p>
      </section>
    )
  }

  const handleCreateInvoice = async () => {
    if (!profile || !address) return
    setCreating(true)
    setError(null)
    const supabase = getSupabaseClient()

    const token = ACCEPTED_TOKENS.find((item) => item.address === tokenAddress)
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

  return (
    <section className="section">
      <div className="section-header">
        <div>
          <h2>Merchant dashboard</h2>
          <p className="muted">
            Create payment links and track settlement status.
          </p>
        </div>
        <div className="stats">
          <div>
            <span className="label">Invoices</span>
            <span className="value">{invoices.length}</span>
          </div>
          <div>
            <span className="label">Wallet</span>
            <span className="value">{formatAddress(profile.address)}</span>
          </div>
        </div>
      </div>

      <BalancesPanel
        address={address}
        title="Wallet balances"
        subtitle="Available stablecoins on Tempo."
        className="card balances"
      />

      <div className="grid two">
        <div className="card">
          <h3>Seller profile</h3>
          <label className="field">
            Seller name
            <input
              value={sellerName}
              onChange={(event) => setSellerName(event.target.value)}
              placeholder="Tempo Studio"
            />
          </label>
          <button
            className="btn ghost"
            onClick={handleSellerSave}
            disabled={savingSeller}
          >
            {savingSeller ? 'Saving…' : 'Save'}
          </button>
        </div>

        <div className="card">
          <h3>Create invoice</h3>
          <div className="grid two">
            <label className="field">
              Amount (USD)
              <input
                value={amountUsd}
                onChange={(event) => setAmountUsd(event.target.value)}
                type="number"
                min="0"
                step="0.01"
              />
            </label>
            <label className="field">
              Receive token
              <select
                value={tokenAddress}
                onChange={(event) => setTokenAddress(event.target.value as `0x${string}`)}
              >
                {ACCEPTED_TOKENS.map((token) => (
                  <option key={token.address} value={token.address}>
                    {token.symbol}
                    {token.faucet ? ' (faucet)' : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            Title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Tempo membership"
            />
          </label>
          <label className="field">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Monthly access to the studio."
            />
          </label>
          <label className="field">
            Image URL
            <input
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="https://"
            />
          </label>
          <label className="field">
            Invoice label (optional)
            <input
              value={invoiceDisplayId}
              onChange={(event) => setInvoiceDisplayId(event.target.value)}
              placeholder="INV-2025-08-023"
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button
            className="btn primary"
            onClick={handleCreateInvoice}
            disabled={creating || !isSupabaseConfigured}
          >
            {creating ? 'Creating…' : 'Generate payment link'}
          </button>
        </div>
      </div>

      <div className="card list">
        <div className="list-header">
          <h3>Recent invoices</h3>
          {loading && <span className="muted">Refreshing…</span>}
        </div>
        {error && <p className="error">{error}</p>}
        {invoices.length === 0 && !loading && (
          <p className="muted">No invoices created yet.</p>
        )}
        {invoices.map((invoice) => {
          const shareUrl = `${window.location.origin}/invoice/${invoice.id}`
          return (
            <div key={invoice.id} className="invoice-row">
              <div>
                <strong>{invoice.title}</strong>
                <p className="muted">{invoice.invoice_display_id ?? invoice.id}</p>
              </div>
              <div>
                <span className={`pill ${invoice.status}`}>{invoice.status}</span>
              </div>
              <div className="amount">
                ${Number(invoice.amount_usd).toFixed(2)} {invoice.token_symbol}
              </div>
              <div className="row-actions">
                <Link className="btn ghost" to={`/invoice/${invoice.id}`}>
                  View
                </Link>
                <button
                  className="btn ghost"
                  onClick={() => navigator.clipboard.writeText(shareUrl)}
                >
                  Copy link
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

const InvoicePage = () => {
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
  >(ACCEPTED_TOKENS[0]?.address ?? '')

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
  const payToken =
    ACCEPTED_TOKENS.find((item) => item.address === payTokenAddress) ?? null
  const invoiceToken =
    ACCEPTED_TOKENS.find((item) => item.address === invoice?.token_address) ??
    null
  const needsSwap =
    Boolean(invoice?.token_address && payTokenAddress) &&
    payTokenAddress !== invoice?.token_address
  const shouldQuote =
    Boolean(needsSwap && payTokenAddress && invoice?.token_address) &&
    Boolean(invoiceAmount)
  const tokenInAddress = (payTokenAddress || zeroAddress) as `0x${string}`
  const tokenOutAddress = (invoice?.token_address || zeroAddress) as `0x${string}`
  const { data: quoteAmountIn, isLoading: quoteLoading } =
    Hooks.dex.useBuyQuote({
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
  const availableBalance =
    payToken && payTokenBalance !== undefined
      ? formatTokenAmount(payTokenBalance, payToken.decimals)
      : '0'
  const quoteDisplay =
    payToken && quoteAmountIn !== undefined
      ? formatTokenAmount(quoteAmountIn, payToken.decimals)
      : null
  const needsApproval =
    Boolean(needsSwap && maxAmountIn && allowance !== undefined) &&
    allowance! < maxAmountIn!
  const isPaying = isPending || isSwapping || isApproving || isBatching
  const payLabel = needsSwap ? 'Swap & Pay' : 'Pay now'
  const payingLabel = isSwapping
    ? 'Swapping…'
    : isApproving
      ? 'Approving…'
      : isBatching
        ? 'Batching…'
      : isPending
        ? 'Sending…'
        : payLabel

  useEffect(() => {
    if (!invoiceId) return
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured.')
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
    if (!invoice || !merchant || !address) return
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

  const token = invoice
    ? ACCEPTED_TOKENS.find((item) => item.address === invoice.token_address)
    : null

  return (
    <section className="section">
      <div className="invoice-shell">
        <div className="invoice-main">
          {loading && <p className="muted">Loading invoice…</p>}
          {error && <p className="error">{error}</p>}
          {invoice && (
            <>
              <div className="invoice-title">
                <h2>{invoice.title}</h2>
                <span className={`pill ${invoice.status}`}>
                  {invoice.status}
                </span>
              </div>
              {invoice.image_url && (
                <div className="invoice-media">
                  <img src={invoice.image_url} alt={invoice.title} />
                </div>
              )}
              <p className="muted">{invoice.description}</p>
              <div className="invoice-details">
                <div>
                  <span className="label">Amount</span>
                  <span className="value">
                    ${Number(invoice.amount_usd).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="label">Token</span>
                  <span className="value">
                    {token?.symbol ?? invoice.token_symbol}
                  </span>
                </div>
                <div>
                  <span className="label">Invoice</span>
                  <span className="value">
                    {invoice.invoice_display_id ?? invoice.id}
                  </span>
                </div>
              </div>
              {invoice.paid_tx_hash && (
                <div className="callout success">
                  Paid on-chain · {invoice.paid_tx_hash.slice(0, 12)}…
                </div>
              )}
            </>
          )}
        </div>
        <div className="invoice-sidebar">
          <h3>Pay invoice</h3>
          {merchant && (
            <div className="merchant-card">
              <span className="label">Seller</span>
              <strong>{merchant.seller_name ?? 'Tempo merchant'}</strong>
              <span className="muted">{formatAddress(merchant.address)}</span>
            </div>
          )}
          <div className="pay-options">
            <label className="field">
              Pay with
              <select
                value={payTokenAddress}
                onChange={(event) =>
                  setPayTokenAddress(event.target.value as `0x${string}`)
                }
                disabled={!invoice || !isConnected}
              >
                {ACCEPTED_TOKENS.map((token) => (
                  <option key={token.address} value={token.address}>
                    {token.symbol}
                  </option>
                ))}
              </select>
            </label>
            {invoice && invoiceToken && (
              <p className="muted">
                Invoice expects {invoiceToken.symbol}.
              </p>
            )}
            {isConnected && payToken && (
              <div className="balance-inline">
                <span className="label">Available</span>
                <span className="value">
                  {balanceLoading ? 'Loading…' : availableBalance} {payToken.symbol}
                </span>
              </div>
            )}
            {needsSwap && (
              <div className="callout">
                We’ll batch approval, swap, and payment when supported.
              </div>
            )}
            {needsSwap && (
              <div className="swap-quote">
                <span className="label">Estimated spend</span>
                <span className="value">
                  {quoteLoading
                    ? 'Fetching…'
                    : quoteDisplay
                      ? `${quoteDisplay} ${payToken?.symbol ?? ''}`
                      : '—'}
                </span>
                <span className="hint">Includes ~1% slippage buffer.</span>
              </div>
            )}
            {needsSwap && (
              <div className="balance-inline">
                <span className="label">DEX allowance</span>
                <span className="value">
                  {allowanceLoading
                    ? 'Checking…'
                    : needsApproval
                      ? 'Approval required (batched)'
                      : 'Ready'}
                </span>
              </div>
            )}
          </div>
          {!isConnected && (
            <button
              className="btn primary"
              onClick={() => connect.connect({ connector })}
              disabled={!isSupabaseConfigured}
            >
              Sign in to pay
            </button>
          )}
          {isConnected && invoice?.status !== 'paid' && (
            <button
              className="btn primary"
              onClick={handlePay}
              disabled={
                isPaying ||
                (needsSwap && !quoteAmountIn) ||
                (needsSwap && (balanceLoading || allowanceLoading))
              }
            >
              {payingLabel}
            </button>
          )}
          {invoice?.status === 'paid' && (
            <button className="btn ghost" disabled>
              Already paid
            </button>
          )}
          <BalancesPanel
            address={address ?? null}
            title="Your balances"
            subtitle="Available tokens on Tempo."
            className="balances-panel"
          />
          {payError && <p className="error">{payError}</p>}
        </div>
      </div>
    </section>
  )
}

export default App
