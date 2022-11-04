import { createServer, createClient } from "../index"
import * as assert from "assert"

async function test() {
    const server = createServer()
    server.connection.on(async ({ data }) => data.readable.pipeTo(data.writable))
    await server.listen()
    const client = createClient({ address: server.address })
    const connection = await client.connect()
    const writer = connection.writable.getWriter()
    const reader = connection.readable.getReader()
    const requests = [Buffer.from("foo"), Buffer.from("bar"), Buffer.from("baz")]
    const responses = []
    for (const request of requests) {
        await writer.write(request)
        const result = await reader.read()
        if (result.done) throw Error("Unexpected end of stream")
        responses.push(result.value)
    }
    await connection.close()
    await server.close()
    assert.deepStrictEqual(responses, requests)
}

test().catch(console.error)