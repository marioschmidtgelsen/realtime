import * as net from "net"

export interface MessageHeader {
    readonly jsonrpc: '2.0'
}
export interface NotificationMessage extends MessageHeader {
    readonly method: string
    readonly params: any[]
}
export interface RequestMessage extends NotificationMessage {
    readonly id: number | string
}
export interface SuccessMessage extends MessageHeader {
    readonly result: any
    readonly id: number | string
}
export enum ErrorCode {
    PARSE_ERROR = -32700, // Invalid JSON was received by the server. An error occurred on the server while parsing the JSON text.
    INVALID_REQUEST = -32600, // The JSON sent is not a valid Request object.
    METHOD_NOT_FOUND = -32601, // The method does not exist / is not available.
    INVALID_PARAMS = -32602, // Invalid method parameter(s).
    INTERNAL_ERROR = -32603, // Internal JSON-RPC error.
    //SERVER_ERROR_xxx = -32000 to -32099 // Reserved for implementation-defined server-errors.
}
export interface ErrorMessage extends MessageHeader {
    readonly code: ErrorCode
    readonly message: string
    readonly data?: any
}
export type ResponseMessage = SuccessMessage | ErrorMessage
export type Message = NotificationMessage | RequestMessage | ResponseMessage
export function isMessageHeader(value: any): value is MessageHeader {
    return value && typeof value == "object"
        && value.jsonrpc && typeof value.jsonrpc == "string" && value.jsonrpc == "2.0"
}
export function isNotificationMessage(value: any): value is NotificationMessage {
    return value.method && typeof value.method == "string" && value.method.length > 0
        && isMessageHeader(value)
} 
export function isRequestMessage(value: any): value is RequestMessage {
    return value.id && (typeof value.id == "number" || typeof value.id == "string")
        && isNotificationMessage(value)
}
export function isSuccessMessage(value: any): value is SuccessMessage {
    return value.id && (typeof value.id == "number" || typeof value.id == "string")
        && isMessageHeader(value)
        && !isErrorMessage(value)
}
export function isErrorMessage(value: any): value is ErrorMessage {
    return value.code && typeof value.code == "number"
        && value.message && typeof value.message == "string"
        && isMessageHeader(value)
}
export function isResponseMessage(value: any): value is ResponseMessage {
    return isSuccessMessage(value)
        || isErrorMessage(value)
}
export function isMessage(value: any): value is Message {
    return isNotificationMessage(value)
        || isRequestMessage(value)
        || isResponseMessage(value)
}
export type CallEventListener = (id: string | number, method: string, params: any[]) => void
export type ResultEventListener = (id: string | number, result: any) => void
export type Method<T = any> = (...args: any[]) => T
export class Endpoint {
    private listener = { "call": new Set<CallEventListener>(), "result": new Set<ResultEventListener>() }
    private methods = new Map<string, Method>()
    private id = 0
    expose<T>(method: Method<T>, name = method.name) {
        this.methods.set(name, method)
    }
    invoke<T>(name: string, ...params: any[]) {
        const method: Method<T> = this.methods.get(name)!
        const id = ++this.id
        const result = method.call(undefined, ...params)
        this.emit("result", id, result)
    }
    on(name: "result", listener: ResultEventListener): void
    on(name: "result", listener: (...args: any[]) => any): void {
        this.listener[name].add(listener)
    }
    off(name: "result", listener: ResultEventListener): boolean
    off(name: "result", listener: (...args: any[]) => any): boolean {
        return this.listener[name].delete(listener)
    }
    emit(name: "result", id: string | number, result: any): void
    emit(name: "result", ...args: any[]): void {
        if (name == "result") this.listener["result"].forEach(listener => listener(args[0], args[1]))
    }
}
export interface ClientOptions { socket?: net.Socket }
export type ResponseEventListener = (response: ResponseMessage) => any
export class Client {
    private listener = { "response": new Map<ResponseEventListener, { once?: true }>() }
    private socket: net.Socket
    private id = 0
    constructor(options: ClientOptions = {}) {
        this.socket = options.socket || new net.Socket()
        this.socket.on("data", (data) => {
            const encoded = data.toString()
            const response = JSON.parse(encoded)
            if (isResponseMessage(response)) this.emit("response", response)
            else throw Error("Unrecognized response message")
        })
    }
    async close() { return new Promise<void>(resolve => this.socket.end(resolve)) }
    async connect(port: number) { return new Promise<void>(resolve => this.socket.connect({ port }, resolve)) }
    invoke<T>(method: string, ...params: any[]) {
        return new Promise<T>((resolve, reject) => {
            const id = ++this.id
            const request: RequestMessage = { jsonrpc: "2.0", id, method, params }
            const encoded = JSON.stringify(request).concat("\r\n")
            const data = Buffer.from(encoded)
            this.once("response", (response) => isSuccessMessage(response) ? response.id == id ? resolve(response.result) : undefined : reject())
            this.write(data)
        })
    }
    async write(data: any) { return new Promise<void>((resolve, reject) => this.socket.write(data, (err) => err ? reject(err.message) : resolve())) }
    on(name: "response", listener: ResponseEventListener) { this.listener[name].set(listener, {}) }
    once(name: "response", listener: ResponseEventListener) { this.listener[name].set(listener, { once: true }) }
    off(name: "response", listener: ResponseEventListener) { return this.listener[name].delete(listener) }
    protected emit(name: "response", response: ResponseMessage) { for (const [listener, options] of this.listener[name]) { listener(response); if (options.once) this.off(name, listener) } }
}
export interface ServerOptions {
    endpoint?: Endpoint
    server?: net.Server
}
export class Server {
    private endpoint: Endpoint
    private server: net.Server
    constructor(options: ServerOptions = {}) {
        this.endpoint = options.endpoint || new Endpoint()
        this.server = options.server || net.createServer()
        this.server.on("connection", (socket) => {
            socket.on("data", (data) => {
                const encoded = data.toString()
                const request = JSON.parse(encoded)
                if (isRequestMessage(request)) {
                    this.endpoint.on("result", (id, result) => {
                        const response: SuccessMessage = { jsonrpc: "2.0", id, result }
                        const encoded = JSON.stringify(response)
                        const data = Buffer.from(encoded)
                        socket.write(data)
                    })
                    this.endpoint.invoke(request.method, ...request.params)
                }
            })
        })
    }
    async close() { return new Promise<void>((resolve, reject) => this.server.close(err => err ? reject(err.message) : resolve())) }
    expose<T>(method: Method<T>, name = method.name) { this.endpoint.expose(method, name) }
    async listen(port: number) { return new Promise<void>(resolve => this.server.listen(port, resolve)) }
}