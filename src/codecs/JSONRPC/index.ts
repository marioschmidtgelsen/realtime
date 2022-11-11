import * as Remoting from "../../remoting"
import { EventSource, EventEmitter } from "../../events"

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
export interface Consumer extends Remoting.Consumer, ReadableWritablePair<RequestMessage, ResponseMessage> { }
export class Consumer extends Remoting.AbstractConsumer implements ReadableWritablePair<RequestMessage, ResponseMessage> {
    readonly readable = new ConsumerRequestStream(this.request)
    readonly writable = new ConsumerResponseStream(this.result)
}
export interface Provider extends Remoting.Provider, ReadableWritablePair<ResponseMessage, RequestMessage> { }
export class Provider extends Remoting.AbstractProvider implements ReadableWritablePair<ResponseMessage, RequestMessage> {
    readonly readable = new ProviderResponseStream(this.result)
    readonly writable = new ProviderRequestStream(this.request)
}
class ConsumerRequestStream extends ReadableStream<RequestMessage> {
    constructor(request: EventSource<Remoting.RequestMessage>) {
        super({
            start(controller) {
                request.on((data) => controller.enqueue({ jsonrpc: "2.0", ...data }))
            }
        })
    }
}
class ConsumerResponseStream extends WritableStream<ResponseMessage> {
    constructor(result: EventEmitter<Remoting.ResponseMessage>) {
        super({
            write(chunk) {
                if (isSuccessMessage(chunk)) result.emit(chunk)
                else throw Error("Unrecognized response message")
            }
        })
    }
}
class ProviderResponseStream extends ReadableStream<ResponseMessage> {
    constructor(result: EventSource<Remoting.ResponseMessage>) {
        super({
            start(controller) {
                result.on((data) => controller.enqueue({ jsonrpc: "2.0", ...data }))
            }
        })
    }
}
class ProviderRequestStream extends WritableStream<RequestMessage> {
    constructor(request: EventEmitter<Remoting.RequestMessage>) {
        super({
            write(chunk) {
                request.emit(chunk)
            }
        })
    }
}