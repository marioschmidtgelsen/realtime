import { createEmitter, EventSource, EventEmitter } from "../events"

export interface Method<TResult = any, TParams extends Array<any> = any[]> {
    (...args: TParams): TResult
}
export interface Invocation<TResult = any, TParams extends Array<any> = any> {
    id: string | number
    method: string
    params: TParams
}
export interface Result<TResult = any> {
    id: string | number
    result: TResult
}
export interface Consumer {
    invoke<TResult = any, TParams extends Array<any> = any>(name: string, ...params: TParams): Promise<TResult>
}
export interface Provider {
    expose<TMethod extends Method<TResult, TParams>, TResult, TParams extends Array<any> = any>(method: TMethod, name?: string): string
}
export function createConsumer() { return new Consumer() }
export function createProvider() { return new Provider() }
export class Consumer {
    #id = 0
    #result = createEmitter<Result>("result", this)
    #invocation = createEmitter<Invocation>("invocation", this)
    get invocation(): EventSource<Invocation> { return this.#invocation }
    get result(): EventEmitter<Result> { return this.#result }
    invoke<TResult = any, TParams extends any[] = any>(method: string, ...params: TParams): Promise<TResult> {
        return new Promise<TResult>(resolve => {
            const id = ++this.#id
            this.#result.on(({ data }) => data.id == id && resolve(data.result))
            this.#invocation.emit({ id, method, params })
        })
    }
}
export class Provider {
    #id = 0
    #methods = new Map<string, Method>()
    #result = createEmitter<Result>("result", this)
    get result(): EventSource<Result> { return this.#result }
    expose<TMethod extends Method<TResult, TParams>, TResult, TParams extends Array<any> = any>(method: TMethod, name = method.name): string {
        if (!name) name = "#".concat((++this.#id).toString())
        this.#methods.set(name, method)
        return name
    }
    async invoke(invocation: Invocation) {
        const id = invocation.id
        const method = invocation.method
        const fn = this.#methods.get(method)
        if (!fn) throw Error("Method not found")
        const result = await fn.call(undefined, ...invocation.params)
        this.#result.emit({ id, result })
    }
}