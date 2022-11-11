import * as Transports from ".."
import * as Events from "../../events"
import * as Streams from "../../streams"
import { TcpConnection } from "./TcpConnection"

import * as http from "http"
import * as net from "net"

Transports.Manager.registerServerFactory({
    createServer(options: Transports.ServerOptions): Transports.Server {
        const url = new URL(options.address)
        if (url.protocol != "http:") throw Error(`Unsupported protocol: '${url.protocol}'`)
        return new HttpServer(options)
    }
})

class HttpServer implements Transports.Server<http.IncomingMessage> {
    #address: string
    #endpoint: Transports.Endpoint<http.IncomingMessage>
    #server: http.Server
    #connection = Events.createEmitter<Transports.Connection, this>("connection", this)
    constructor(options: Transports.ServerOptions) {
        this.#address = options.address
        this.#endpoint = options.endpoint
        this.#server = http.createServer()
        this.#server.on("connection", (socket) => this.#connection.emit(new TcpConnection(socket)))
        this.#server.on("request", async (req, res) => {
            const readable = new HttpServerRequestStream(req)
            const writable = new HttpServerResponseStream(res)
            await this.#endpoint.channel({ readable, writable })
        })
    }
    get address() { return this.#address }
    get connection(): Events.EventSource<Transports.Connection, this> { return this.#connection }
    get endpoint() { return this.#endpoint }
    async close() {
        return new Promise<void>((resolve, reject) => this.#server.close(err => err ? reject(err.message) : resolve()))
    }
    async listen() {
        return new Promise<this>(resolve => this.#server.listen(this.getListenOptions(), () => { this.#address = this.getListeningAddress()!; resolve(this) }))
    }
    protected getListenOptions(): net.ListenOptions {
        const url = new URL(this.#address)
        return { port: url.port == "" ? undefined : parseInt(url.port) }
    }
    protected getListeningAddress() {
        const addressInfoOrString = this.#server.address()
        if (!addressInfoOrString) return
        if (typeof addressInfoOrString == "string") return `http://[${addressInfoOrString}]`
        else return `http://[${addressInfoOrString.address}]:${addressInfoOrString.port}`
    }
}
class HttpServerRequestStream extends Streams.ReadableStream<http.IncomingMessage> {
    constructor(request: http.IncomingMessage) { super(new HttpServerRequestSource(request)) }
}
class HttpServerRequestSource implements Streams.UnderlyingSource<http.IncomingMessage> {
    constructor(protected request: http.IncomingMessage) { }
    start(controller: Streams.ReadableStreamDefaultController<http.IncomingMessage>) {
        controller.enqueue(this.request)
    }
}
class HttpServerResponseStream extends Streams.WritableStream {
    constructor(response: http.ServerResponse) { super(new HttpServerResponseSink(response)) }
}
class HttpServerResponseSink implements Streams.UnderlyingSink {
    constructor(protected response: http.ServerResponse) { }
    close() { this.response.end() }
    write(chunk: any) {
        if (Transports.Http.Server.isHeaderResponse(chunk)) this.response.writeHead(chunk.statusCode, chunk.statusMessage)
        else this.response.write(chunk)
    }
}