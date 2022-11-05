import { Transformer } from "../streams"
import { createEmitter, EventSource } from "../events"

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
export interface Consumer<TRequest, TResponse> extends Transformer<TResponse, TRequest> {
    invoke<TResult = any, TParams extends Array<any> = any>(name: string, ...params: TParams): Promise<TResult>
    invoked: EventSource<Invocation, this>
    results: EventSource<Result, this>
}
export abstract class AbstractConsumer<TRequest, TResponse> implements Consumer<TRequest, TResponse> {
    #invoked = createEmitter<Invocation>("invoked", this)
    #results = createEmitter<Result>("results", this)
    get invoked() { return this.#invoked }
    get results() { return this.#results }
    async invoke<R = any, AX extends Array<any> = any[]>(method: string, ...params: AX): Promise<R> {
        return new Promise<R>(resolve => {
            const id = this.generateIdentification()
            const invocation = { id, method, params }
            this.#results.on(({ data }) => data.id == id && resolve(data.result))
            this.#invoked.emit(invocation)
        })
    }
    start(controller: TransformStreamDefaultController<TRequest>) {
        this.#invoked.on(({ data }) => controller.enqueue(this.encodeRequestMessage(data)))
    }
    transform(chunk: TResponse) {
        this.#results.emit(this.decodeResponseMessage(chunk))
    }
    protected abstract generateIdentification(): string | number
    protected abstract decodeResponseMessage(response: TResponse): Result
    protected abstract encodeRequestMessage(invocation: Invocation): TRequest
}
export interface Provider<TRequest, TResponse> extends Transformer<TRequest, TResponse> {
    expose<TMethod extends Method<TResult, TParams>, TResult, TParams extends Array<any> = any>(method: TMethod, name?: string): void
}
export abstract class AbstractProvider<TRequest, TResponse> implements Provider<TRequest, TResponse> {
    #methods = new Map<string, Method>()
    #results = createEmitter<Result>("results", this)
    expose<TMethod extends Method<TResult, TParams>, TResult, TParams extends Array<any> = any>(method: TMethod, name = method.name): void {
        this.#methods.set(name, method)
    }
    protected abstract decodeRequestMessage(request: TRequest): Invocation
    protected abstract encodeResponseMessage(result: Result): TResponse
    start(controller: TransformStreamDefaultController<TResponse>) {
        this.#results.on(({ data }) => controller.enqueue(this.encodeResponseMessage(data)))
    }
    transform(chunk: TRequest) {
        const invocation = this.decodeRequestMessage(chunk)
        const method = this.#methods.get(invocation.method)!
        const result = method(...invocation.params)
        this.#results.emit({ id: invocation.id, result })
    }
}