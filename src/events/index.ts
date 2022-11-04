export interface EventMessage<T = any, S = any> {
    name: string
    data: T
    source: S
}
export type EventListener<T = any, S = any> = (data: EventMessage<T, S>) => any
export interface EventSource<T = any, S = any> {
    on(listener: EventListener<T, S>): void
    once(listener: EventListener<T, S>): void
    off(listener: EventListener<T, S>): boolean
}
export interface EventEmitter<T = any, S = any> extends EventSource<T, S> {
    emit(data: T): void
}
export function createEmitter<T = any, S = any>(name: string, source: S): EventEmitter<T, S> {
    return new EventEmitterImpl(name, source)
}

class EventEmitterImpl<T = any, S = any> implements EventSource<T, S> {
    private listener = new Map<EventListener<T, S>, { once?: true }>()
    constructor(readonly name: string, readonly source: S) {}
    on(listener: EventListener<T, S>): void { this.listener.set(listener, {}) }
    once(listener: EventListener<T, S>): void { this.listener.set(listener, { once: true }) }
    off(listener: EventListener<T, S>): boolean { return this.listener.delete(listener) }
    emit(data: T): void {
        const message: EventMessage<T, S> = { name: this.name, source: this.source, data }
        for (const [listener, options] of this.listener) {
            listener(message)
            if (options.once) this.listener.delete(listener)
        }
    }
}