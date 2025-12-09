import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { WagmiProvider } from 'wagmi'
import { config } from './config/createConfig.ts'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
    <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
            <App />
        </QueryClientProvider>
    </WagmiProvider>
)
