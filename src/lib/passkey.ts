import type { Storage } from '@wagmi/core'
import { Address, PublicKey } from 'ox'
import { getSupabaseClient } from './supabaseClient'

export type StoredCredential = {
  id: string
  publicKey: string
}

const ensureHexPrefix = (value: string): `0x${string}` =>
  (value.startsWith('0x') ? value : `0x${value}`) as `0x${string}`

export const deriveAddress = (publicKey: string) =>
  Address.fromPublicKey(PublicKey.fromHex(ensureHexPrefix(publicKey)))

export const getActiveCredential = async (
  storage?: Storage | null
): Promise<StoredCredential | null> => {
  const credential = await storage?.getItem('webAuthn.activeCredential')
  if (!credential || typeof credential !== 'object') return null
  const { id, publicKey } = credential as {
    id?: string
    publicKey?: string
  }
  if (!id || !publicKey) return null
  return { id, publicKey: ensureHexPrefix(publicKey) }
}

export const upsertPasskeyCredential = async (
  storage: Storage | null | undefined,
  profileId?: string | null
) => {
  const credential = await getActiveCredential(storage)
  if (!credential) return null
  const address = deriveAddress(credential.publicKey).toLowerCase()
  const supabase = getSupabaseClient()
  const { error } = await supabase.from('passkey_credentials').upsert(
    {
      credential_id: credential.id,
      public_key: credential.publicKey,
      address,
      user_id: profileId ?? null,
      last_used_at: new Date().toISOString(),
    },
    { onConflict: 'credential_id' }
  )
  if (error) throw error
  return { ...credential, address }
}

export const supabaseKeyManager = {
  async getPublicKey(parameters: { credential: { id: string } }) {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('passkey_credentials')
      .select('public_key')
      .eq('credential_id', parameters.credential.id)
      .maybeSingle()
    if (error) throw error
    if (!data?.public_key) throw new Error('public key not found')
    return data.public_key
  },
  async setPublicKey(parameters: {
    credential: { id: string }
    publicKey: string
  }) {
    const publicKey = ensureHexPrefix(parameters.publicKey)
    const address = deriveAddress(publicKey).toLowerCase()
    const supabase = getSupabaseClient()
    const { error } = await supabase.from('passkey_credentials').upsert(
      {
        credential_id: parameters.credential.id,
        public_key: publicKey,
        address,
      },
      { onConflict: 'credential_id' }
    )
    if (error) throw error
  },
}
