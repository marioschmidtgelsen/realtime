import { createEndpoint, Endpoint, Method, ResultEventData, RequestMessage, ResponseMessage, SuccessMessage, isRequestMessage } from "./index"
import { EventSource } from "../../events"
import { TextDecoderStream, TextEncoderStream, TransformStream } from "../../streams"
import { JSONDecoderStream, JSONEncoderStream } from "../../codecs/JSON"
import * as Transports from "../../transports"

export interface Server extends Endpoint, Transports.Server { }
export function createServer(options: Transports.ServerOptions = {}): Server {
    return new JSONRPCServer(options)
}

class JSONRPCServer implements Endpoint, Transports.Server {
    #endpoint = createEndpoint()
    #transport: Transports.Server
    constructor(options: Transports.ServerOptions = {}) {
        this.#transport = Transports.createServer(options)
        this.#transport.connection.on(({ data }) => {
            data.readable
            .pipeThrough(new TextDecoderStream())
            .pipeThrough(new JSONDecoderStream<RequestMessage>())
            .pipeThrough(new JSONRPCRequestHandler(this.#endpoint))
            .pipeThrough(new JSONEncoderStream<ResponseMessage>())
            .pipeThrough(new TextEncoderStream())
            .pipeTo(data.writable)
        })
    }
    get address() { return this.#transport.address }
    get connection(): EventSource<Transports.Connection, this> { return this.#transport.connection as EventSource<Transports.Connection, this> }
    async close() { return this.#transport.close() }
    expose<T>(method: Method<T>, name = method.name) { this.#endpoint.expose(method, name) }
    invoke(name: string, ...params: any[]) { this.#endpoint.invoke(name, ...params) }
    async listen() { return this.#transport.listen() }
    get result() { return this.#endpoint.result as EventSource<ResultEventData, this> }
}
class JSONRPCRequestHandler extends TransformStream<RequestMessage, ResponseMessage> {
    constructor(endpoint: Endpoint) {
        super({
            start(controller) {
                endpoint.result.on(({ data: { id, result }}) => {
                    const response: SuccessMessage = { jsonrpc: "2.0", id, result }
                    controller.enqueue(response)
                })
            },
            transform(request) {
                if (!isRequestMessage(request)) throw Error("Unexpected request message")
                endpoint.invoke(request.method, ...request.params)
            }
        })
    }
}