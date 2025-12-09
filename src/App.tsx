import { useEffect } from 'react'
import { useConnect, useConnectors, useConnection, useDisconnect } from 'wagmi'

const App = () => {

    const { address, isConnected } = useConnection()
    const connect = useConnect()
    const [connector] = useConnectors()
    const { disconnect } = useDisconnect()

    useEffect(() => {
        console.log(isConnected)
    }, [isConnected, address])

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
        </div>
    )
}

export default App
