import * as Transports from ".."
import * as Events from "../../events"
import * as net from "net"

import { TcpConnection } from "./TcpConnection"

Transports.Manager.registerServerFactory({
    createServer<T extends Transports.Endpoint>(options: Transports.ServerOptions<T>): Transports.Server<T> {
        const url = new URL(options.address)
        if (url.protocol != "tcp:") throw Error(`Unsupported protocol: '${url.protocol}'`)
        return new TcpServer(options)
    }
})

class TcpServer<T extends Transports.Endpoint> implements Transports.Server<T> {
    #address: string
    #endpoint: T
    #server: net.Server
    #connection = Events.createEmitter<Transports.Connection>("connection", this)
    constructor(options: Transports.ServerOptions<T>) {
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
        return new Promise<string>(resolve => this.#server.listen(this.getListenOptions(), () => resolve(this.#address = this.getListeningAddress()!)))
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