export type KeyGenerator = <T extends object>(entity: Partial<T>) => any
export type ProxyGenerator = <T extends object>(manager: Manager, entity: T, key: any) => T
export type MergeStrategy = <T extends object>(manager: Manager, entity: T, changes: Partial<T>) => void
export interface Options {
    readonly keyGenerator: KeyGenerator
    readonly proxyGenerator?: ProxyGenerator
    readonly mergeStrategy?: MergeStrategy
}
export type AttachEventListener = <T extends object>(entity: T) => any
export type DetachEventListener = <T extends object>(key: T) => any
export type MergeEventListener = <T extends object>(key: T, changes: Partial<T>) => any
export class Manager {
    private entities = new Map<any, object>()
    private listener = { "attach": new Set<AttachEventListener>, "detach": new Set<DetachEventListener>, "merge": new Set<MergeEventListener> }
    readonly keyGenerator: KeyGenerator
    readonly proxyGenerator: ProxyGenerator
    readonly mergeStrategy: MergeStrategy
    constructor(options: Options) {
        this.keyGenerator = options.keyGenerator
        this.proxyGenerator = options.proxyGenerator || createEntityProxy
        this.mergeStrategy = options.mergeStrategy || mergeEntityChanges
    }
    attach<T extends object>(entity: T): T {
        // Generate an entity key
        const key = this.keyGenerator(entity)
        // Check if object is not attached already
        if (this.entities.has(key)) throw Error("Entity already attached")
        // Add the object as a managed entity
        this.entities.set(key, entity)
        // Wrap the entity into an entity proxy
        const proxy = this.proxyGenerator(this, entity, key)
        // Emit the "attach" event
        this.emit("attach", proxy)
        // Return the entity proxy
        return proxy
    }
    detach<T extends object>(entity: T): void {
        // Generate the entity key
        const key = this.keyGenerator(entity)
        // Check if entity is attached
        if (!this.entities.has(key)) throw Error("Entity not attached")
        // Delete the managed entity
        this.entities.delete(key)
        // Emit the "detach" event
        this.emit("detach", key)
    }
    find<T extends object>(key: any): T | undefined {
        // Try to get managed entity
        const entity = this.entities.get(key) as T
        // Wrap the entity into an entity proxy
        const proxy = this.proxyGenerator(this, entity, key)
        // Return the entity proxy
        return proxy
    }
    merge<T extends object>(key: any, changes: Partial<T>) {
        // Try to get managed entity
        const entity = this.entities.get(key)
        // Check if entity is attached
        if (!entity) throw Error("Entity not attached")
        // Merge changes into managed entity
        this.mergeStrategy(this, entity, changes)
        // Emit the "merge" event
        this.emit("merge", key, changes)
    }
    on(name: "attach", listener: AttachEventListener): void
    on(name: "detach", listener: DetachEventListener): void
    on(name: "merge", listener: MergeEventListener): void
    on(name: "attach" | "detach" | "merge", listener: (...args: any) => any) {
        this.listener[name].add(listener)
    }
    off(name: "attach", listener: AttachEventListener): boolean
    off(name: "detach", listener: DetachEventListener): boolean
    off(name: "attach" | "detach", listener: (...args: any) => any): boolean {
        return this.listener[name].delete(listener)
    }
    protected emit<T extends object>(name: "attach", entity: T): void
    protected emit(name: "detach", key: any): void
    protected emit<T extends object>(name: "merge", key: any, changes: Partial<T>): void
    protected emit(name: "attach" | "detach" | "merge", ...args: any[]): void {
        if (name == "attach") this.listener["attach"].forEach(listener => listener(args[0]))
        else if (name == "detach") this.listener["detach"].forEach(listener => listener(args[0]))
        else if (name == "merge") this.listener["merge"].forEach(listener => listener(args[0], args[1]))
        else throw Error("Invalid event")
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