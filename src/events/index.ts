export interface Message<T = any, S = any> {
    name: string
    data: T
    source: S
}
export type Listener<T = any, S = any> = (data: Message<T, S>) => any
export interface Event<T = any, S = any> {
    on(listener: Listener<T, S>): void
    once(listener: Listener<T, S>): void
    off(listener: Listener<T, S>): boolean
}
export class Emitter<T = any, S = any> implements Event<T, S> {
    private listener = new Map<Listener<T, S>, { once?: true }>()
    constructor(readonly name: string, readonly source: S) {}
    on(listener: Listener<T, S>): void { this.listener.set(listener, {}) }
    once(listener: Listener<T, S>): void { this.listener.set(listener, { once: true }) }
    off(listener: Listener<T, S>): boolean { return this.listener.delete(listener) }
    emit(data: T): void {
        const message: Message<T, S> = { name: this.name, source: this.source, data }
        for (const [listener, options] of this.listener) {
            listener(message)
            if (options.once) this.listener.delete(listener)
        }
    }
}