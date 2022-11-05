import { Provider, Consumer } from "./codecs/JSONRPC"
import { createServer, createClient } from "./transports"

async function main() {
    function foo() { return "bar" }
    // Create a JSONRPC provider and expose methods
    const provider = new Provider()
    provider.expose(foo)
    // Create a TCP server and start listening
    const server = createServer({ address: "tcp://[::]", endpoint: provider })
    await server.listen()
    // Create a JSONRPC consumer
    const consumer = new Consumer()
    // Create a TCP client and connect server
    const client = createClient({ address: server.address, endpoint: consumer })
    const connection = await client.connect()
    // Invoke remote method
    const result = await consumer.invoke("foo")
    console.info(result)
    // Cleanup connection and server
    await connection.close()
    await server.close()
}

main().catch(console.error)