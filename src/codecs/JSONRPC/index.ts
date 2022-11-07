import * as JSON from "../JSON"
import * as Remotes from "../../remotes"
import * as Transports from "../../transports"
import { TextDecoderStream, TextEncoderStream, ReadableWritablePair, ReadableStream } from "../../streams"
import { createEmitter, EventEmitter, EventSource } from "../../events"

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
export type MethodResultMessage = { jsonrpc: "2.0", method: string }
export function isMethodResultMessage(value: any): value is MethodResultMessage {
    return value.method && typeof value.method == "string" && value.method.length > 0 && isMessageHeader(value)
}
export function createEndpoint(consumer = Remotes.createConsumer(), provider = Remotes.createProvider()) {
    return new Endpoint(consumer, provider)
}

class Endpoint implements Transports.Endpoint {
    constructor(readonly consumer: Remotes.Consumer, readonly provider: Remotes.Provider) { }
    async channel({ readable, writable }: ReadableWritablePair) {
        const consumer = this.consumer
        const provider = this.provider
        const parameterTransformer = new BidirectionalParameterTransformer(consumer, provider)
        const resultTransformer = new BidirectionalResultTransformer(consumer, provider)
        readable
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new JSON.DecoderStream<Message>())
        .pipeTo(new WritableStream({
            write(chunk: Message) {
                if (isRequestMessage(chunk)) {
                    const params = parameterTransformer.visit(chunk.params)
                    provider.invoke({ id: chunk.id, method: chunk.method, params })
                }
                else if (isSuccessMessage(chunk)) {
                    const result = resultTransformer.visit(chunk.result)
                    consumer.result.emit({ ...chunk, result })
                }
            }
        }))
        new ReadableStream<Message>({
            start(controller) {                
                consumer.invocation.on((data) => {
                    const params = parameterTransformer.visit(data.params)
                    controller.enqueue({ jsonrpc: "2.0", id: data.id, method: data.method, params })
                })
                provider.result.on((data) => {
                    const result = resultTransformer.visit(data.result)
                    controller.enqueue({ jsonrpc: "2.0", id: data.id, result })
                })
            }
        })
        .pipeThrough(new JSON.EncoderStream())
        .pipeThrough(new TextEncoderStream())
        .pipeTo(writable)
    }
}
class ObjectVisitor {
    visit(value: any): any {
        if (!value) return undefined
        else if (Array.isArray(value)) return this.visitArray(value)
        else if (typeof value == "function") return this.visitFunction(value)
        else if (typeof value == "object") return this.visitObject(value)
        else return value
    }
    visitArray<T extends any[]>(value: T): any {
        return value.map(element => this.visit(element))
    }
    visitFunction<T extends (...args: any) => any>(value: T): any {
        return value
    }
    visitObject<T extends object>(value: T): any {
        const entries = []
        for (const [propertyKey, propertyValue] of Object.entries(value)) {
            const transform = this.visit(propertyValue)
            entries.push([propertyKey, transform])
        }
        return Object.fromEntries(entries)
    }
}
class BidirectionalParameterTransformer extends ObjectVisitor {
    constructor(protected consumer: Remotes.Consumer, protected provider: Remotes.Provider) { super() }
    visit(value: any): any {
        if (!value) return undefined
        else if (isMethodResultMessage(value)) return this.visitMethodResultMessage(value)
        else if (Array.isArray(value)) return this.visitArray(value)
        else if (typeof value == "function") return this.visitFunction(value)
        else if (typeof value == "object") return this.visitObject(value)
        else return value
    }
    visitMethodResultMessage(value: MethodResultMessage) {
        return (...params: any[]) => this.consumer.invoke(value.method, ...params)
    }
    visitFunction<T extends (...args: any) => any>(value: T): MethodResultMessage {
        const method = this.provider.expose(value)
        return { jsonrpc: "2.0", method } as MethodResultMessage
    }
}
class BidirectionalResultTransformer extends ObjectVisitor {
    constructor(protected consumer: Remotes.Consumer, protected provider: Remotes.Provider) { super() }
    visit(value: any): any {
        if (!value) return undefined
        else if (isMethodResultMessage(value)) return this.visitMethodResultMessage(value)
        else if (Array.isArray(value)) return this.visitArray(value)
        else if (typeof value == "function") return this.visitFunction(value)
        else if (typeof value == "object") return this.visitObject(value)
        else return value
    }
    visitMethodResultMessage(value: MethodResultMessage) {
        return (...params: any[]) => this.consumer.invoke(value.method, ...params)
    }
    visitFunction<T extends (...args: any) => any>(value: T): MethodResultMessage {
        const method = this.provider.expose(value)
        return { jsonrpc: "2.0", method } as MethodResultMessage
    }
}