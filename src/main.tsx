import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'

import App from './App.tsx'
import { config } from './config/createConfig.ts'
import './index.css'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
    <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <App />
            </BrowserRouter>
        </QueryClientProvider>
    </WagmiProvider>
)
