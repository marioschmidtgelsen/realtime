import { EventSource, EventEmitter, createEmitter } from "../events"

export interface RequestMessage {
    id: string | number
    method: string
    params: any[]
}
export interface ResponseMessageHeader {
    id: string | number
}
export interface ResultMessage extends ResponseMessageHeader {
    result: any
}
export function isResultMessage(value: any): value is ResultMessage {
    return typeof value == "object" && value.id && (typeof value.id == "string" || typeof value.id == "number") && value.result
}
export type ResponseMessage = ResultMessage
export interface Consumer {
    readonly request: EventSource<RequestMessage, this>
    readonly result: EventEmitter<ResultMessage, this>
    invoke<T, AX extends any[]>(method: string, ...params: AX): Promise<T>
}
export interface Provider {
    readonly request: EventEmitter<RequestMessage, this>
    readonly result: EventSource<ResultMessage, this>
    expose<T extends Function>(fn: T, name?: string): string
}
export abstract class AbstractConsumer implements Consumer {
    #id = 0
    #request = createEmitter<RequestMessage>("request", this)
    #result = createEmitter<ResultMessage>("result", this)
    get request(): EventSource<RequestMessage, this> { return this.#request }
    get result(): EventEmitter<ResultMessage, this> { return this.#result }
    async invoke<T, AX extends any[]>(method: string, ...params: AX): Promise<T> {
        return new Promise<T>(resolve => {
            const id = ++this.#id
            this.#result.on((data) => data.id == id && resolve(data.result))
            this.#request.emit({ id, method, params })
        })
    }
}
export abstract class AbstractProvider implements Provider {
    #methods = new Map<string, Function>()
    #request = createEmitter<RequestMessage>("request", this)
    #result = createEmitter<ResultMessage>("result", this)
    constructor() {
        this.#request.on(({ id, method, params }) => this.invoke(id, method, ...params))
    }
    get request(): EventEmitter<RequestMessage, this> { return this.#request }
    get result(): EventSource<ResultMessage, this> { return this.#result }
    expose<T extends Function>(fn: T, name = fn.name) {
        this.#methods.set(name, fn)
        return name
    }
    protected invoke<T = any, AX extends any[] = any[]>(id: number | string, method: string, ...params: AX): T {
        const fn = this.#methods.get(method)
        if (!fn) throw Error("Method not found")
        const result = fn.call(undefined, ...params)
        this.#result.emit({ id, result })
        return result
    }
}