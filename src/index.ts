import * as JSONRPC from "./codecs/JSONRPC"
import * as Transports from "./transports"

interface Mock {
    foo(): Promise<string>
    bar(x?: string): Promise<string>
    baz(f: () => string): Promise<string>
}
class Mock {
    foo = async () => "foo"
    bar = async (x?: string) => x || "bar"
    baz = async (f: () => string) => f()
}

async function main() {
    // Create the server object
    const mock = new Mock()
    // Create a TCP/IP transport server with a bidirectional JSONRPC endpoint
    const server = Transports.createServer({ address: "tcp://[::]", endpoint: JSONRPC.createEndpoint() })
    await server.listen()
    // Expose the server object's methods on the JSONRPC provider-side
    server.endpoint.provider.expose(mock, "mock")
    // Get server's listening address
    const address = server.address
    {
        // Create a TCP/IP transport client with a bidirectional JSONRPC endpoint
        const client = Transports.createClient({ address, endpoint: JSONRPC.createEndpoint() })
        await client.connect()
        // Create a delegating proxy stub on the JSONRPC consumer-side
        const mock = client.endpoint.consumer.proxy<Mock>("mock")
        // Remote invocation
        console.info(await mock.foo()) // client->server->client
        console.info(await mock.bar("bar")) // client->server->client
        console.info(await mock.baz(() => "baz")) // client->server->client->server->client
        // Close transport client
        await client.close()
    }
    // Close transport server
    await server.close()
}

main().catch(console.error)