import * as Transports from "../.."
import * as Events from "../../../events"
import * as Streams from "../../../streams"
import { TcpConnection } from "./TcpConnection"
import * as http from "http"

Transports.Manager.registerClientFactory({
    createClient(options: Transports.ClientOptions): Transports.Client {
        const url = new URL(options.address)
        if (url.protocol != "http:") throw Error(`Unsupported protocol: '${url.protocol}'`)
        return new HttpClient(options)
    }
})

class HttpClient implements Transports.Client<http.IncomingMessage> {
    #address: string
    #endpoint: Transports.Endpoint
    #connection = Events.createEmitter<Transports.Connection>("connection", this)
    #request?: http.ClientRequest
    constructor(options: Transports.ClientOptions) {
        this.#address = options.address
        this.#endpoint = options.endpoint
    }
    get address() { return this.#address }
    async close() {
    }
    get connection(): Events.EventSource<Transports.Connection, this> { return this.#connection }
    async connect() {
        return new Promise<Transports.Connection>((resolve, reject) => {
            this.#request = http.get(
                this.getRequestOptions(),
                (response) => {
                    const readable = new HttpClientResponseStream(this.#request!, response)
                    const writable = new HttpClientRequestStream()
                    this.#endpoint.channel({ readable, writable })
                }).on("error", (err) => {
                    console.error(err.message)
                }).on("socket", (socket) => {
                    const connection = new TcpConnection(socket)
                    this.#connection.emit(connection)
                }
            )
        })
    }
    get endpoint() { return this.#endpoint }
    protected getRequestOptions(): http.RequestOptions {
        const url = new URL(this.#address)
        return {
            host: url.host,
            port: parseInt(url.port),
            path: url.pathname
        }
    }
}
class HttpClientResponseStream extends Streams.ReadableStream<http.IncomingMessage> {
    constructor(request: http.ClientRequest, response: http.IncomingMessage) { super(new HttpClientResponseSource(request, response)) }
}
class HttpClientResponseSource implements Streams.UnderlyingSource<http.IncomingMessage> {
    constructor(protected request: http.ClientRequest, protected response: http.IncomingMessage) { }
    start(controller: Streams.ReadableStreamDefaultController<http.IncomingMessage>) {
        controller.enqueue(this.response)
    }
}
class HttpClientRequestStream extends Streams.WritableStream {
}