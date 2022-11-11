import * as Transports from ".."
import "./TcpClient"
import "./TcpServer"
import { expect } from "../../tests"

export async function testTcpClientServer() {
    const server = Transports.Manager.createServer({ address: "tcp://[::]", endpoint: {
        async channel(connection) {
            connection.readable.pipeTo(connection.writable)
        }
    }})
    await server.listen()
    const results = new Array<string>()
    const client = Transports.Manager.createClient({ address: server.address, endpoint: {
        async channel(connection) {
            console.debug("[endpoint][channel]")
            const writer = connection.writable.getWriter()
            const reader = connection.readable.getReader()
            console.debug("[endpoint][channel] => writer.write()")
            await writer.write(Buffer.from("foo"))
            console.debug("[endpoint][channel] <= writer.write()")
            console.debug("[endpoint][channel] => reader.read()")
            var result = await reader.read()
            console.debug("[endpoint][channel] <= reader.read()")
            if (!result.done) results.push(result.value.toString())
            console.debug("[endpoint][channel] => writer.write()")
            await writer.write(Buffer.from("bar"))
            console.debug("[endpoint][channel] <= writer.write()")
            console.debug("[endpoint][channel] => reader.read()")
            var result = await reader.read()
            console.debug("[endpoint][channel] <= reader.read()")
            if (!result.done) results.push(result.value.toString())
            console.debug("[endpoint][channel] => writer.close()")
            await writer.close()
            console.debug("[endpoint][channel] <= writer.close()")
            console.debug("[endpoint][channel] => connection.close()")
            await connection.close()
            console.debug("[endpoint][channel] <= connection.close()")
        }
    }})
    client.connection.on((data) => console.debug("[client][connection]"))
    console.debug("[client] => connect()")
    const connection = await client.connect()
    console.debug("[client] <= connect()")
    connection.closed.on(async (data) => {
        console.debug("[client][connection][closed]")
        console.debug("[client][connection][closed] => server.close()")
        await server.close()
        console.debug("[client][connection][closed] <= server.close()")
        expect(results).equals(["foo", "bar"])
    })
}