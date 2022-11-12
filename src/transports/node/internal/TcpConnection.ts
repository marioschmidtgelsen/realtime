import * as Transports from "../.."
import * as Streams from "../../../streams"
import * as Events from "../../../events"
import * as net from "net"

export class TcpConnection implements Transports.Connection {
    #socket: net.Socket
    #readable: TcpReadableStream
    #writable: TcpWritableStream
    #closed = Events.createEmitter("close", this)
    constructor(socket: net.Socket) {
        this.#socket = socket
        this.#readable = new TcpReadableStream(socket)
        this.#writable = new TcpWritableStream(socket)
        socket.on("close", (hadError) => this.#closed.emit(undefined))
    }
    close(): Promise<void> {
        return new Promise<void>(resolve => this.#socket.end(() => resolve()))
    }
    get closed(): Events.EventSource<void, this> { return this.#closed }
    get readable(): Streams.ReadableStream<Uint8Array> { return this.#readable }
    get writable(): Streams.WritableStream<Uint8Array> { return this.#writable }
}
class TcpReadableStream extends Streams.ReadableStream<Uint8Array> {
    constructor(socket: net.Socket) { super(new TcpSocketSource(socket)) }
}
class TcpSocketSource implements Streams.UnderlyingSource<Uint8Array> {
    #socket: net.Socket
    constructor(socket: net.Socket) { this.#socket = socket }
    start(controller: Streams.ReadableStreamDefaultController<Uint8Array>) {
        this.#socket.on("data", (data) => controller.enqueue(data))
        this.#socket.on("close", () => controller.close())
    }
}
class TcpWritableStream extends Streams.WritableStream<Uint8Array> {
    constructor(socket: net.Socket) { super(new TcpSocketSink(socket)) }
}
class TcpSocketSink implements Streams.UnderlyingSink<Uint8Array> {
    #socket: net.Socket
    constructor(socket: net.Socket) { this.#socket = socket }
    async write(chunk: Uint8Array) {
        return new Promise<void>((resolve, reject) => this.#socket.write(chunk, (err) => err ? reject(err.message) : resolve()))
    }
}