import { createEmitter, EventSource, EventListener } from "../events"

export type KeyGenerator = <T extends object>(entity: Partial<T>) => any
export type EntityGenerator = <T extends object>(manager: EntityManager, entity: T, key: any) => T
export type MergeStrategy = <T extends object>(manager: EntityManager, entity: T, changes: Partial<T>) => void
export interface ManagerOptions {
    readonly keyGenerator: KeyGenerator
    readonly entityGenerator?: EntityGenerator
    readonly mergeStrategy?: MergeStrategy
}
export type AttachedEventData = { entity: object }
export type DetachedEventData = { key: any }
export type MergedEventData = { key: any, changes: object }
export interface EntityManager {
    attached: EventSource<AttachedEventData, this>
    detached: EventSource<DetachedEventData, this>
    merged: EventSource<MergedEventData, this>
    attach<T extends object>(entity: T): T
    detach<T extends object>(entity: T): void
    find<T extends object>(key: any): T | undefined
    merge<T extends object>(entity: T, changes: Partial<T>): void
    subscribe<T extends object>(entity: T): Subscription
    unsubscribe(subscription: Subscription): void
}
export interface Subscription {
    detached: EventSource<DetachedEventData, this>
    merged: EventSource<MergedEventData, this>
    unsubscribe(): void
}
export function createManager(options: ManagerOptions) {
    return new EntityManagerImpl(options)
}

class EntityManagerImpl implements EntityManager {
    #entities = new Map<any, object>()
    #attached = createEmitter<AttachedEventData>("attached", this)
    #detached = createEmitter<DetachedEventData>("detached", this)
    #merged = createEmitter<MergedEventData>("merged", this)
    #keyGenerator: KeyGenerator
    #entityGenerator: EntityGenerator
    #mergeStrategy: MergeStrategy
    #subscriptions = new Set<Subscription>()
    constructor(options: ManagerOptions) {
        this.#keyGenerator = options.keyGenerator
        this.#entityGenerator = options.entityGenerator || EntityManagerImpl.createEntityProxy
        this.#mergeStrategy = options.mergeStrategy || EntityManagerImpl.mergeEntityChanges
    }
    get attached(): EventSource<AttachedEventData, this> { return this.#attached }
    get detached(): EventSource<DetachedEventData, this> { return this.#detached }
    get merged(): EventSource<MergedEventData, this> { return this.#merged }
    attach<T extends object>(entity: T): T {
        // Generate an entity key
        const key = this.#keyGenerator(entity)
        // Check if object is not attached already
        if (this.#entities.has(key)) throw Error("Entity already attached")
        // Add the object as a managed entity
        this.#entities.set(key, entity)
        // Wrap the entity into an entity proxy
        const proxy = this.#entityGenerator(this, entity, key)
        // Emit the "attach" event
        this.#attached.emit({ entity: proxy })
        // Return the entity proxy
        return proxy
    }
    detach<T extends object>(entity: T): void {
        // Generate the entity key
        const key = this.#keyGenerator(entity)
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
        const proxy = this.#entityGenerator(this, entity, key)
        // Return the entity proxy
        return proxy
    }
    merge<T extends object>(entity: T, changes: Partial<T>): void {
        // Generate the entity key
        const key = this.#keyGenerator(entity)
        // Get managed entity by key to unwrap proxies
        const real = this.#entities.get(key)
        // Check if entity is attached
        if (!real) throw Error("Entity not attached")
        // Merge changes into managed entity
        this.#mergeStrategy(this, real, changes)
        // Emit the "merge" event
        this.#merged.emit({ key, changes })
    }
    subscribe<T extends object>(entity: T): Subscription {
        // Generate the entity key
        const key = this.#keyGenerator(entity)
        // Check if entity is attached
        if (!this.#entities.has(key)) throw Error("Entity not attached")
        // Generate an event subscription
        const subscription = new SubscriptionImpl(this, key)
        // Add the event subscription to subscriptions set
        this.#subscriptions.add(subscription)
        // Return the subscription object
        return subscription
    }
    unsubscribe(subscription: Subscription) {
        // Delete the event subscription from subscriptions set
        if (!this.#subscriptions.delete(subscription)) throw Error("Illegal access")
    }
    private static createEntityProxy<T extends object>(manager: EntityManager, entity: T, key: any): T {
        const changeTracker = new ChangeTrackerImpl(manager, key)
        return new Proxy<T>(entity, changeTracker)
    }
    private static mergeEntityChanges<T extends object>(manager: EntityManager, entity: T, changes: Partial<T>) {
        for (const [propertyKey, value] of Object.entries(changes)) {
            if (!Reflect.set(entity, propertyKey, value)) throw Error("Illegal access")
        }
    }
}
class ChangeTrackerImpl<T extends object> implements ProxyHandler<T> {
    constructor(protected manager: EntityManager, protected key: any) { }
    set(target: T, p: string | symbol, newValue: any, receiver: any): boolean {
        this.manager.merge(this.key, { [p]: newValue })
        return true
    }
}
class SubscriptionImpl implements Subscription {
    #detached = createEmitter("detached", this)
    #merged = createEmitter("merged", this)
    #detach: EventListener<DetachedEventData>
    #merge: EventListener<MergedEventData>
    constructor(readonly manager: EntityManager, readonly key: any) {
        this.#merge = (data: MergedEventData) => {
            if (data.key == this.key) { 
                this.#merged.emit(data)
            }
        }
        manager.merged.on(this.#merge)
        this.#detach = (data: DetachedEventData) => {
            if (data.key == this.key) {
                this.#detached.emit(data)
                this.unsubscribe()
            }
        }
        manager.detached.on(this.#detach)
    }
    get detached() { return this.#detached }
    get merged() { return this.#merged }
    unsubscribe() {
        this.manager.merged.off(this.#merge)
        this.manager.detached.off(this.#detach)
        this.manager.unsubscribe(this)
    }
}