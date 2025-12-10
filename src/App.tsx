import { useEffect } from 'react'
import { useConnect, useConnectors, useConnection, useDisconnect } from 'wagmi'

import { Hooks } from 'tempo.ts/wagmi'
import { parseUnits } from 'viem'

const App = () => {

    const { address, isConnected } = useConnection()
    const connect = useConnect()
    const [connector] = useConnectors()
    const { disconnect } = useDisconnect()

    const { mutate: enableFaucet , isPending } = Hooks.faucet.useFundSync()
    const { mutate: sendPayments } = Hooks.token.useTransferSync()

    const recipient = ('0x0000000000000000000000000000000000000000') as `0x${string}`
    const memo = ('') as `0x${string}`

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
            <button onClick={() => {
                sendPayments({
                    amount: parseUnits('100', 6),
                    to: recipient,
                    token: '0x20c0000000000000000000000000000000000001',
                    memo: memo && memo.length > 0
                        ? `0x${memo.padEnd(64, '0')}` as `0x${string}`
                        : undefined,
                    // Assuming the API requires 'feeToken'. Using same token as in 'token' field for now.
                    feeToken: '0x20c0000000000000000000000000000000000001',
                })
            }}>
                Great! Send 10 USD Now.
            </button>
        </div>
    )
}

export default App
