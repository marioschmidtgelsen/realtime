import { createManager, KeyGenerator } from "../entities"
import * as JSONRPC from "../remotes/jsonrpc"

async function test() {
    // Setup an entity manager with a managed entity
    interface Mock { key: number, foo: string }
    const isMock = (value: any): value is Mock => typeof value == "object" && "key" in value && typeof value.key == "number" && "foo" in value && typeof value.foo == "string"
    const keyGenerator: KeyGenerator = (entity) => isMock(entity) ? entity.key : entity
    const options = { keyGenerator }
    const manager = createManager(options)
    const entity = manager.attach({ key: 42, foo: "foo" })
    // Setup a JSON RPC server and expose entity manager's methods
    const server = JSONRPC.createServer()
    server.expose((key) => manager.find(key), "find")
    server.expose((key, changes) => manager.merge(key, changes), "merge")
    await server.listen()
    // Setup a JSON RPC client and connect to JSON RPC server
    const client = JSONRPC.createClient({ address: server.address })
    await client.connect()
    // Remote invocation to find managed entity
    const result = await client.invoke("find", 42)
    console.info(result) // result == entity
    // Remote invocation to change managed entity
    await client.invoke("merge", 42, { foo: "bar" })
    console.info(entity)
    // Cleanup client and server
    await client.close()
    await server.close()
}

test().catch(console.error)