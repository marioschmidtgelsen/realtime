import * as Transports from "../.."
import * as Events from "../../../events"
import * as net from "net"

import { TcpConnection } from "./TcpConnection"

Transports.Manager.registerClientFactory({
    createClient(options: Transports.ClientOptions): Transports.Client {
        const url = new URL(options.address)
        if (url.protocol != "tcp:") throw Error(`Unsupported protocol: '${url.protocol}'`)
        return new TcpClient(options)
    }
})

class TcpClient implements Transports.Client {
    #address: string
    #endpoint: Transports.Endpoint
    #socket: net.Socket
    #connection = Events.createEmitter<Transports.Connection>("connection", this)
    constructor(options: Transports.ClientOptions) {
        this.#address = options.address
        this.#endpoint = options.endpoint
        this.#socket = new net.Socket()
        this.#socket.on("connect", async () => {
            const connection = new TcpConnection(this.#socket)
            this.#connection.emit(connection)
            await this.#endpoint.channel(connection)
        })
    }
    get address() { return this.#address }
    async close() {
        return new Promise<void>((resolve) => this.#socket.end(() => resolve()))
    }
    get connection(): Events.EventSource<Transports.Connection, this> { return this.#connection }
    async connect() {
        return new Promise<Transports.Connection>((resolve) => {
            this.#connection.once((data) => resolve(data))
            this.#socket.connect(this.getConnectOptions())
        })
    }
    get endpoint() { return this.#endpoint }
    protected getConnectOptions() {
        return { port: parseInt(new URL(this.#address).port) }
    }
}