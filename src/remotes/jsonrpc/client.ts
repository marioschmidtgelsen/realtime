import { ResponseMessage, RequestMessage, isSuccessMessage } from "."
import * as Transports from "../../transports"
import { createEmitter, EventSource, EventEmitter } from "../../events"
import { TextDecoderStream, TextEncoderStream, ReadableStream, WritableStream, UnderlyingSource, ReadableStreamDefaultController, UnderlyingSink } from "../../streams"
import { JSONDecoderStream, JSONEncoderStream } from "../../codecs/JSON"

export function createClient(options: Transports.ClientOptions) {
    return new JSONRPCClient(options)
}

class JSONRPCClient {
    #connection?: Transports.Connection
    #id = 0
    #response = createEmitter<ResponseMessage>("response", this)
    #request = createEmitter<RequestMessage>("request", this)
    #transport: Transports.Client
    constructor(options: Transports.ClientOptions) {
        this.#transport = Transports.createClient(options)
    }
    async close() { await this.#connection!.close() }
    async connect() {
        this.#connection = await this.#transport.connect()
        this.#connection.readable
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new JSONDecoderStream<ResponseMessage>())
        .pipeTo(new WritableStream(new JSONRPCResponseEventSink(this.#response)))
        new ReadableStream(new JSONRPCRequestEventSource(this.#request))
        .pipeThrough(new JSONEncoderStream())
        .pipeThrough(new TextEncoderStream())
        .pipeTo(this.#connection.writable)
    }
    async invoke<T>(method: string, ...params: any[]): Promise<T> {
        return new Promise<T>(resolve => {
            const id = ++this.#id
            this.#response.on(({ data }) => {
                if (isSuccessMessage(data)) {
                    if (data.id == id) {
                        resolve(data.result)
                    }
                }
            })
            this.#request.emit({ jsonrpc: "2.0", id, method, params })
        })
    }
    get response(): EventSource<ResponseMessage> { return this.#response }
    get request(): EventSource<RequestMessage> { return this.#request }
}
class JSONRPCRequestEventSource implements UnderlyingSource<RequestMessage> {
    constructor(protected event: EventSource<RequestMessage>) { }
    async start(controller: ReadableStreamDefaultController<RequestMessage>) {
        this.event.on(({ data }) => controller.enqueue(data))
    }
}
class JSONRPCResponseEventSink implements UnderlyingSink<ResponseMessage> {
    constructor(protected event: EventEmitter<ResponseMessage>) { }
    write(chunk: ResponseMessage) {
        this.event.emit(chunk)
    }
}