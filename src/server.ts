import { createManager, KeyGenerator } from "./entities/index"
import * as Remotes from "./remotes/index"

async function main() {
    interface Mock { key: number, foo: string }
    const isMock = (value: any): value is Mock => typeof value == "object" && "key" in value && typeof value.key == "number" && "foo" in value && typeof value.foo == "string"
    
    const keyGenerator: KeyGenerator = (entity) => isMock(entity) ? entity.key : entity
    const options = { keyGenerator }
    const manager = createManager(options)
    const entity = manager.attach({ key: 42, foo: "foo" })
    console.info(entity)
    manager.merged.on((ev) => console.info(entity))
    
    const server = new Remotes.JSONRPC.Server()
    server.expose((key) => manager.find(key), "find")
    server.expose((key, changes) => manager.merge(key, changes), "merge")
    await server.listen(3000)
}

main().catch(console.error)