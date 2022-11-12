import * as Transports from "../.."
import * as Events from "../../../events"
import * as net from "net"

import { TcpConnection } from "./TcpConnection"

Transports.Manager.registerServerFactory({
    createServer(options: Transports.ServerOptions): Transports.Server {
        const url = new URL(options.address)
        if (url.protocol != "tcp:") throw Error(`Unsupported protocol: '${url.protocol}'`)
        return new TcpServer(options)
    }
})

export class TcpServer implements Transports.Server {
    #address: string
    #endpoint: Transports.Endpoint
    #server: net.Server
    #connection = Events.createEmitter<Transports.Connection>("connection", this)
    constructor(options: Transports.ServerOptions) {
        this.#address = options.address || "tcp://[::]"
        this.#endpoint = options.endpoint
        this.#server = net.createServer()
        this.#server.on("connection", (socket) => {
            const connection = new TcpConnection(socket)
            this.#connection.emit(connection)
            if (this.#endpoint) this.#endpoint.channel(connection)
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
        if (typeof addressInfoOrString == "string") return `tcp://[${addressInfoOrString}]`
        else return `tcp://[${addressInfoOrString.address}]:${addressInfoOrString.port}`
    }
}