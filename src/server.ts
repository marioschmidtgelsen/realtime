import { WebService, Get } from "./services/web"
import * as Transports from "./transports"
import "./transports/node"

class Foo {
    @Get
    foo() {
        return { foo: { bar: { baz: 42 } } }
    }
}

async function main() {
    const service = new Foo()
    const endpoint = new WebService(service)
    const server = Transports.Manager.createServer({ address: "http://[::]:8080", endpoint })
    await server.listen()
}

main().catch(console.error)