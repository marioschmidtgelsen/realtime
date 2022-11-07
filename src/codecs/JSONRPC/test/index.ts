import * as JSONRPC from ".."
import * as Transports from "../../../transports"
import { setTimeout } from "timers/promises"
import { createEmitter } from "../../../events"

async function testE2E() {
    class Mock {
        readonly foo = createEmitter<string>("foo", this)
    }
    // Create the event source
    const mock = new Mock()
    // Create the remote JSONRPC endpoint
    const remote = JSONRPC.createEndpoint()
    // Expose remote event binding method
    remote.provider.expose(mock.foo.bind().on, "mock.foo.on")
    // Create a TCP/IP transport server
    const server = Transports.createServer({ address: "tcp://[::]", endpoint: remote })
    await server.listen()
    // Get server's listening address
    const address = server.address
    // Create the local JSONRPC endpoint
    const local = JSONRPC.createEndpoint()
    // Create a TCP/IP transport client
    const client = Transports.createClient({ address, endpoint: local })
    await client.connect()
    // Bind local event listener to remote event
    await client.endpoint.consumer.invoke("mock.foo.on", (data: any) => console.info(data))
    // Emit remote event
    mock.foo.emit("bar")
    // Wait for results to settle
    await setTimeout(100)
    // Cleanup
    await client.close()
    await server.close()
}

testE2E().catch(console.error)