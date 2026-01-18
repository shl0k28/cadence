import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { ChakraProvider } from '@chakra-ui/react'

import App from './App.tsx'
import { config } from './config/createConfig.ts'
import theme from './theme.ts'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
    <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
            <ChakraProvider theme={theme}>
                <BrowserRouter>
                    <App />
                </BrowserRouter>
            </ChakraProvider>
        </QueryClientProvider>
    </WagmiProvider>
)
