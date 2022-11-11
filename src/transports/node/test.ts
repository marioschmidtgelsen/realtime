import * as Transports from ".."
import * as Streams from "../../streams"
import "./TcpClient"
import "./TcpServer"
import "./HttpClient"
import "./HttpServer"
import { expect } from "../../tests"

export async function testTcpClientServer() {
    const server = await Transports.Manager.createServer({
        address: "tcp://[::]",
        endpoint: {
            async channel({ readable, writable }) {
                readable.pipeTo(writable)
            }
        }
    })
    .listen()
    await Transports.Manager.createClient({
        address: server.address,
        endpoint: {
            async channel(connection: Transports.Connection) {
                const chunk = Buffer.from("PING")
                connection.writable.getWriter().write(chunk)
                const result = await connection.readable.getReader().read()
                expect(!result.done).ok()
                expect(result.value).equals(chunk)
                await connection.close()
                await server.close()
            }
        }
    })
    .connect()
}

export async function testHttpClientServer() {
    const mock = { foo: "bar" }
    const server = await Transports.Manager.createServer({
        address: "http://[::]",
        endpoint: {
            async channel({ readable, writable }) {
                readable
                .pipeThrough(new Streams.FilterStream(request => request.method == "GET" && request.url == "/"))
                .pipeThrough(new Streams.TransformStream({
                    async start(controller: Streams.TransformStreamDefaultController<any>) {
                        controller.enqueue({ statusCode: 200 })
                        controller.enqueue(Buffer.from(JSON.stringify(mock)))
                        controller.terminate()
                    }
                }))
                .pipeTo(writable)
            }
        }
    })
    .listen()
    await Transports.Manager.createClient({
        address: server.address.concat("/"),
        endpoint: {
            async channel({ readable, writable }) {
                readable
                .pipeThrough(new Streams.FilterStream(response => response.statusCode == 200))
                .pipeThrough(new Streams.TransformStream({
                    async transform(response: Transports.Http.IncomingMessage) {
                        const decoder = new TextDecoder()
                        var text = ""; for await (const chunk of response) { text += decoder.decode(chunk) }
                        var data = JSON.parse(text)
                        expect(data).equals(mock)
                        await server.close()
                    }
                }))
                .pipeTo(writable)
            }
        }
    })
    .connect()
}