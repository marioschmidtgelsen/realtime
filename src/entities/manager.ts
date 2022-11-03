import * as Events from "../events/index"

export type KeyGenerator = <T extends object>(entity: Partial<T>) => any
export type ProxyGenerator = <T extends object>(manager: Manager, entity: T, key: any) => T
export type MergeStrategy = <T extends object>(manager: Manager, entity: T, changes: Partial<T>) => void
export interface Options {
    readonly keyGenerator: KeyGenerator
    readonly proxyGenerator?: ProxyGenerator
    readonly mergeStrategy?: MergeStrategy
}
export type AttachedEventData = { entity: object }
export type DetachedEventData = { key: any }
export type MergedEventData = { key: any, changes: object }
export class Manager {
    #entities = new Map<any, object>()
    #attached = new Events.Emitter<AttachedEventData>("attached", this)
    #detached = new Events.Emitter<DetachedEventData>("detached", this)
    #merged = new Events.Emitter<MergedEventData>("merged", this)
    readonly keyGenerator: KeyGenerator
    readonly proxyGenerator: ProxyGenerator
    readonly mergeStrategy: MergeStrategy
    constructor(options: Options) {
        this.keyGenerator = options.keyGenerator
        this.proxyGenerator = options.proxyGenerator || createEntityProxy
        this.mergeStrategy = options.mergeStrategy || mergeEntityChanges
    }
    get attached(): Events.Event<AttachedEventData, this> { return this.#attached }
    get detached(): Events.Event<DetachedEventData, this> { return this.#detached }
    get merged(): Events.Event<MergedEventData, this> { return this.#merged }
    attach<T extends object>(entity: T): T {
        // Generate an entity key
        const key = this.keyGenerator(entity)
        // Check if object is not attached already
        if (this.#entities.has(key)) throw Error("Entity already attached")
        // Add the object as a managed entity
        this.#entities.set(key, entity)
        // Wrap the entity into an entity proxy
        const proxy = this.proxyGenerator(this, entity, key)
        // Emit the "attach" event
        this.#attached.emit({ entity: proxy })
        // Return the entity proxy
        return proxy
    }
    detach<T extends object>(entity: T): void {
        // Generate the entity key
        const key = this.keyGenerator(entity)
        // Check if entity is attached
        if (!this.#entities.has(key)) throw Error("Entity not attached")
        // Delete the managed entity
        this.#entities.delete(key)
        // Emit the "detach" event
        this.#detached.emit({ key })
    }
    find<T extends object>(key: any): T | undefined {
        // Try to get managed entity
        const entity = this.#entities.get(key) as T
        // Wrap the entity into an entity proxy
        const proxy = this.proxyGenerator(this, entity, key)
        // Return the entity proxy
        return proxy
    }
    merge<T extends object>(key: any, changes: Partial<T>) {
        // Try to get managed entity
        const entity = this.#entities.get(key)
        // Check if entity is attached
        if (!entity) throw Error("Entity not attached")
        // Merge changes into managed entity
        this.mergeStrategy(this, entity, changes)
        // Emit the "merge" event
        this.#merged.emit({ key, changes })
    }
}
class ChangeTracker<T extends object> implements ProxyHandler<T> {
    constructor(protected manager: Manager, protected key: any) { }
    set(target: T, p: string | symbol, newValue: any, receiver: any): boolean {
        this.manager.merge(this.key, { [p]: newValue })
        return true
    }
}
function createEntityProxy<T extends object>(manager: Manager, entity: T, key: any): T {
    const changeTracker = new ChangeTracker(manager, key)
    return new Proxy<T>(entity, changeTracker)
}
function mergeEntityChanges<T extends object>(manager: Manager, entity: T, changes: Partial<T>) {
    for (const [propertyKey, value] of Object.entries(changes)) {
        if (!Reflect.set(entity, propertyKey, value)) throw Error("Illegal access")
    }
}