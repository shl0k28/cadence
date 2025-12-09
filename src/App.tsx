import { useEffect } from 'react'
import { useConnect, useConnectors, useConnection, useDisconnect } from 'wagmi'

import { Hooks } from 'tempo.ts/wagmi'

const App = () => {

    const { address, isConnected } = useConnection()
    const connect = useConnect()
    const [connector] = useConnectors()
    const { disconnect } = useDisconnect()

    const { mutate: enableFaucet , isPending } = Hooks.faucet.useFundSync()

    useEffect(() => {
        console.log(isConnected)
    }, [isConnected, address])

    const faucet = async () => {
        console.log(`Emitting faucet trigger`)
        enableFaucet({
            account: address!
        })
    }


    return (
        <div>
            <p>Checkout with Tempo</p>
            {
                isConnected && address && (
                    <div>
                        <p>{address.slice(0,6)}...{address.slice(-6)}</p>
                        <p>{address}</p>
                        <button onClick={() => {
                            disconnect()
                        }}>logout</button>
                    </div>
                )
            }
            <button onClick={() => {
                // @ts-ignore
                connect.connect({ connector, withCapabilities: true, capabilities: {
                    type: 'sign-up'
                }})
            }}>
                Sign Up
            </button>
            <button onClick={() => {
                connect.connect({ connector })
            }}>
                Sign In
            </button>
            <p>{`Don't have funds yet? Get some test funds`}</p>
            <button onClick={faucet} disabled={isPending}>Get Test Funds</button>
        </div>
    )
}

export default App
