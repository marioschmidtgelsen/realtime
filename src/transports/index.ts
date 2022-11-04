import { createEmitter, EventSource } from "../events"
import { ReadableWritablePair, ReadableStream, UnderlyingSource, ReadableStreamDefaultController, WritableStream, UnderlyingSink } from "../streams"
import * as net from "net"

export interface ServerOptions {
    address?: string
    server?: net.Server
}
export interface Server {
    connection: EventSource<Connection, this>
    readonly address: string
    close(): Promise<void>
    listen(): Promise<string>
}
export interface ClientOptions {
    address: string
    socket?: net.Socket
}
export interface Client {
    readonly address: string
    connect(): Promise<Connection>
}
export interface Connection extends ReadableWritablePair {
    closed: EventSource<void, this>
    close(): Promise<void>
}

class TcpServer implements Server {
    #address: string
    #server: net.Server
    #connection = createEmitter<Connection>("connection", this)
    constructor(options: ServerOptions = {}) {
        this.#address = options.address || "tcp://[::]"
        this.#server = options.server || net.createServer()
        this.#server.on("connection", (socket) => this.#connection.emit(new TcpConnection(socket)))
    }
    get address() { return this.#address }
    get connection(): EventSource<Connection, this> { return this.#connection }
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
export function createServer(options: ServerOptions = {}): Server {
    return new TcpServer(options)
}

class TcpClient implements Client {
    #address: string
    #socket: net.Socket
    #connection = createEmitter<Connection>("connection", this)
    constructor(options: ClientOptions) {
        this.#address = options.address
        this.#socket = options.socket || new net.Socket()
    }
    get address() { return this.#address }
    async close() {
        return new Promise<void>((resolve) => this.#socket.end(() => resolve()))
    }
    get connection(): EventSource<Connection, this> { return this.#connection }
    async connect() {
        return new Promise<Connection>(resolve => this.#socket.connect(this.getConnectOptions(), () => resolve(new TcpConnection(this.#socket))))
    }
    protected getConnectOptions() {
        return { port: parseInt(new URL(this.#address).port) }
    }
}
export function createClient(options: ClientOptions): Client {
    return new TcpClient(options)
}

class TcpConnection implements Connection {
    #socket: net.Socket
    #readable: TcpReadableStream
    #writable: TcpWritableStream
    #closed = createEmitter("close", this)
    constructor(socket: net.Socket) {
        this.#socket = socket
        this.#readable = new TcpReadableStream(socket)
        this.#writable = new TcpWritableStream(socket)
        socket.on("close", (hadError) => this.#closed.emit(undefined))
    }
    close(): Promise<void> {
        return new Promise<void>(resolve => this.#socket.end(() => resolve()))
    }
    get closed(): EventSource<void, this> { return this.#closed }
    get readable(): ReadableStream<Uint8Array> { return this.#readable }
    get writable(): WritableStream<Uint8Array> { return this.#writable }
}
class TcpReadableStream extends ReadableStream<Uint8Array> {
    constructor(socket: net.Socket) { super(new TcpSocketSource(socket)) }
}
class TcpSocketSource implements UnderlyingSource<Uint8Array> {
    #socket: net.Socket
    constructor(socket: net.Socket) { this.#socket = socket }
    start(controller: ReadableStreamDefaultController<Uint8Array>) {
        this.#socket.on("data", (data) => controller.enqueue(data))
        this.#socket.on("close", () => controller.close())
    }
}
class TcpWritableStream extends WritableStream<Uint8Array> {
    constructor(socket: net.Socket) { super(new TcpSocketSink(socket)) }
}
class TcpSocketSink implements UnderlyingSink<Uint8Array> {
    #socket: net.Socket
    constructor(socket: net.Socket) { this.#socket = socket }
    async write(chunk: Uint8Array) {
        return new Promise<void>((resolve, reject) => this.#socket.write(chunk, (err) => err ? reject(err.message) : resolve()))
    }
}