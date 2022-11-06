import * as JSONRPC from "./codecs/JSONRPC"
import * as Transports from "./transports"

async function main() {
    // Create the remote JSONRPC endpoint
    const remote = JSONRPC.createEndpoint()
    // Configure the remoting provider
    remote.provider.expose(function foo() { return "foo" })
    remote.provider.expose(function bar() { return () => "bar" })
    remote.provider.expose((f: () => string) => f(), "baz")
    // Create a TCP/IP transport server
    const server = Transports.createServer({ address: "tcp://[::]", endpoint: remote })
    await server.listen()
    // Get server's listening address
    const address = server.address
    // Create the local JSONRPC endpoint
    const local = JSONRPC.createEndpoint()
    // Configure the remoting provider
    local.provider.expose(function cow() { return "moo" })
    // Create a TCP/IP transport client
    const client = Transports.createClient({ address, endpoint: local })
    await client.connect()
    // Remote invocation of a function on the server initiated by the client (client -> server)
    console.info(await local.consumer.invoke("foo"))
    // Remote invocation with callback function result (client -> server, client -> server)
    const outer = await local.consumer.invoke("bar")
    const inner = await outer()
    console.info(inner)
    // Remote invocation using a client function as the callback argument (client -> server -> client)
    const result = await local.consumer.invoke("baz", () => "baz")
    console.info(result)
    // Remote invocation of a function executing on the client initiated by the server (server -> client)
    console.info(await remote.consumer.invoke("cow"))
    // Cleanup
    await client.close()
    await server.close()
}

main().catch(console.error)