import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { ChakraProvider } from '@chakra-ui/react'

// Import Iosevka font variations
import '@fontsource/iosevka/400.css'
import '@fontsource/iosevka/500.css'
import '@fontsource/iosevka/600.css'
import '@fontsource/iosevka/700.css'
import '@fontsource/iosevka/400-italic.css'
import '@fontsource/iosevka-curly/400.css'
import '@fontsource/iosevka-curly/600.css'
import '@fontsource/iosevka-curly/700.css'
import '@fontsource/iosevka-etoile/400.css'
import '@fontsource/iosevka-etoile/600.css'

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
