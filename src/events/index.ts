export type EventListener<T = any> = (data: T) => any
export interface EventSource<T = any, S = any> {
    name: string
    source: S
    on(listener: EventListener<T>): void
    once(listener: EventListener<T>): void
    off(listener: EventListener<T>): boolean
}
export interface EventEmitter<T = any, S = any> extends EventSource<T, S> {
    bind(): {
        emit: (data: T) => void,
        on: (listener: EventListener<T>) => void
    }
    emit(data: T): void
}
export function createEmitter<T = any, S = any>(name: string, source: S): EventEmitter<T, S> {
    return EventManager.create(name, source)
}
type ListenerOptions = { once?: true }
type Listeners<T = any> = Map<EventListener<T>, ListenerOptions>
type Descriptor<T = any, S = any> = Map<EventSource<T, S>, Listeners<T>>
export class EventManager {
    private static descriptors = new Map<any, Descriptor>()
    static bind<T = any, S = any>(event: EventSource<T, S>) {
        return {
            emit: this.emit.bind<typeof EventManager, EventSource<T, S>, [data: T], void>(this, event),
            on: this.on.bind<typeof EventManager, EventSource<T, S>, [listener: EventListener<T>], void>(this, event),
        }
    }
    static create<T = any, S = any>(name: string, source: S): EventEmitter<T, S> {
        const event = new Emitter<T, S>(name, source)
        const exist = this.descriptors.get(source)
        const entry = exist || new Map<EventSource<T, S>, Map<EventListener, ListenerOptions>>()
        entry.set(event, new Map<EventListener<T>, ListenerOptions>())
        if (!exist) this.descriptors.set(source, entry)
        return event
    }
    static emit<T = any, S = any>(event: EventSource<T, S>, data: T) {
        const entry: Descriptor<T, S> = this.descriptors.get(event.source)!
        const listeners = entry.get(event)!
        for (const [listener, options] of listeners) {
            listener(data)
            if (options.once) listeners.delete(listener)
        }
    }
    static event<T = any, S = any>(source: S, name: string): EventSource<T, S> | undefined {
        const entry: Descriptor<T, S> = this.descriptors.get(source)!
        for (const event of entry.keys()) if (event.name == name) return event
    }
    static events<S = any>(source: S): IterableIterator<EventSource<any, S>> {
        return this.descriptors.get(source)!.keys()
    }
    static on<T = any, S = any>(event: EventSource<T, S>, listener: EventListener<T>) {
        const entry: Descriptor<T, S> = this.descriptors.get(event.source)!
        const listeners = entry.get(event)!
        listeners.set(listener, {})
    }
    static once<T = any, S = any>(event: EventSource<T, S>, listener: EventListener<T>) {
        const entry: Descriptor<T, S> = this.descriptors.get(event.source)!
        const listeners = entry.get(event)!
        listeners.set(listener, { once: true })
    }
    static off<T = any, S = any>(event: EventSource<T, S>, listener: EventListener<T>): boolean {
        const entry: Descriptor<T, S> = this.descriptors.get(event.source)!
        const listeners = entry.get(event)!
        return listeners.delete(listener)
    }
}
class Emitter<T = any, S = any> implements EventSource<T, S> {
    constructor(readonly name: string, readonly source: S) { }
    bind() { return EventManager.bind(this) }
    emit(data: T): void { EventManager.emit(this, data) }
    on(listener: EventListener<T>): void { EventManager.on(this, listener) }
    once(listener: EventListener<T>): void { EventManager.once(this, listener) }
    off(listener: EventListener<T>): boolean { return EventManager.off(this, listener) }
}