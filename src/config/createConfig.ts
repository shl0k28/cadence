import { tempo } from 'tempo.ts/chains'
import { webAuthn } from 'tempo.ts/wagmi'
import { createConfig, http } from 'wagmi'

import { supabaseKeyManager } from '../lib/passkey'
 
export const config = createConfig({
  connectors: [
    webAuthn({
      keyManager: supabaseKeyManager
    }),
  ],
  chains: [tempo({ feeToken: '0x20c0000000000000000000000000000000000001' })],
  multiInjectedProviderDiscovery: false,
  transports: {
    [tempo.id]: http(),
  },
})
