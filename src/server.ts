import { KeyGenerator, createManager } from "./entities"
import { createServer } from "./remotes/jsonrpc"

async function main() {
    // Setup an entity manager with a managed entity
    interface Mock { key: number, foo: string }
    const isMock = (value: any): value is Mock => typeof value == "object" && "key" in value && typeof value.key == "number" && "foo" in value && typeof value.foo == "string"
    const keyGenerator: KeyGenerator = (entity) => isMock(entity) ? entity.key : entity
    const options = { keyGenerator }
    const manager = createManager(options)
    const entity = manager.attach({ key: 42, foo: "foo" })
    // Create an RPC server
    const server = createServer({ address: "tcp://[::]:3000" })
    // Expose entity manager's "find" method
    server.expose((key) => manager.find(key), "find")
    // Listen for incoming connections
    await server.listen()
}

main().catch(console.error)