import * as Remotes from "../../remotes"
import * as JSON from "../JSON"
import { TextDecoderStream, TextEncoderStream, ReadableWritablePair, TransformStream } from "../../streams"

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
export interface FunctionMessage extends MessageHeader {
    readonly method: string
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
export function isFunctionMessage(value: any): value is FunctionMessage {
    return value.method && (typeof value.method == "string") && (value.method.length > 0)
        && value.id && (typeof value.id == "number" || typeof value.id == "string")
        && isMessageHeader(value)
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
export class Consumer extends Remotes.AbstractConsumer<RequestMessage, ResponseMessage> {
    #identification = 0
    channel({ readable, writable }: ReadableWritablePair): Promise<void> {
        return readable
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new JSON.DecoderStream<ResponseMessage>())
        .pipeThrough(new TransformStream(this))
        .pipeThrough(new JSON.EncoderStream<RequestMessage>())
        .pipeThrough(new TextEncoderStream())
        .pipeTo(writable)
    }
    protected generateIdentification(): number {
        return ++this.#identification
    }
    protected encodeRequestMessage({ id, method, params }: Remotes.Invocation): RequestMessage {
        return { jsonrpc: "2.0", id, method, params }
    }
    protected decodeResponseMessage(response: ResponseMessage): Remotes.Result {
        if (isSuccessMessage(response)) return response
        throw Error(`Unexpected response: ${response}`)
    }
}
export class Provider extends Remotes.AbstractProvider<RequestMessage, ResponseMessage> {
    channel({ readable, writable }: ReadableWritablePair): Promise<void> {
        return readable
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new JSON.DecoderStream<RequestMessage>())
        .pipeThrough(new TransformStream(this))
        .pipeThrough(new JSON.EncoderStream<ResponseMessage>())
        .pipeThrough(new TextEncoderStream())
        .pipeTo(writable)
    }
    protected decodeRequestMessage({ id, method, params }: RequestMessage): Remotes.Invocation {
        return { id, method, params }
    }
    protected encodeResponseMessage({ id, result }: Remotes.Result<any>): ResponseMessage {
        return { jsonrpc: "2.0", id, result }
    }
}