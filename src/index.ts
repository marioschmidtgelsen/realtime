import { createClient } from "./remotes/jsonrpc"

async function main() {
    // Create an RPC client
    const client = createClient({ address: "tcp://[::]:3000" })
    // Connect to RPC server
    await client.connect()
    // Invoke remote entity manager's "find" method
    const result = await client.invoke("find", 42)
    console.info(result)
    // Cleanup RPC client
    await client.close()
}

main().catch(console.error)