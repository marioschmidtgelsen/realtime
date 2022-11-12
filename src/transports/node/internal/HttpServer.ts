import * as Http from "../../http"
import * as Transports from "../.."
import * as Events from "../../../events"
import * as Streams from "../../../streams"

import * as http from "http"
import * as net from "net"
import { UnderlyingSinkCloseCallback } from "stream/web"

Transports.Manager.registerServerFactory({
    createServer(options: Transports.ServerOptions): Transports.Server {
        const url = new URL(options.address)
        if (url.protocol != "http:") throw Error(`Unsupported protocol: '${url.protocol}'`)
        return new HttpServer(options)
    }
})

class HttpServer implements Transports.Server<Http.Server.Request> {
    #address: string
    #endpoint: Transports.Endpoint<Http.Server.Request>
    #server: http.Server
    #connection = Events.createEmitter<HttpServerConnection, this>("connection", this)
    constructor(options: Transports.ServerOptions) {
        this.#address = options.address
        this.#endpoint = options.endpoint
        this.#server = http.createServer()
        this.#server.on("connection", async (socket) => {
            const connection = new HttpServerConnection(this.#server, socket)
            this.#connection.emit(connection)
            await this.#endpoint.channel(connection)
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

class HttpServerConnection implements Transports.Connection {
    #readable: Streams.ReadableStream<Http.Server.Request>
    #writable: Streams.WritableStream
    #closed = Events.createEmitter("closed", this)
    #request?: http.IncomingMessage
    #response?: http.ServerResponse
    constructor(server: http.Server, socket: net.Socket) {
        const self = this
        this.#readable = new Streams.ReadableStream({
            start(controller: Streams.ReadableStreamDefaultController<Http.Server.Request>) {
                server.on("request", (req, res) => {
                    if (req.socket == socket) {
                        self.#request = req
                        self.#response = res
                        controller.enqueue({ method: req.method!, url: req.url! })
                    }
                })
            }
        })
        this.#writable = new Streams.WritableStream({
            close() {
                self.#response?.end()
            },
            write(chunk, controller) {
                self.#response?.write(chunk)
            }
        })
    }
    get closed(): Events.EventSource<void, this> { return this.#closed }
    get readable(): Streams.ReadableStream<Http.Server.Request> { return this.#readable }
    get writable(): Streams.WritableStream { return this.#writable }
    async close() {
        this.#response?.destroy()
    }
}