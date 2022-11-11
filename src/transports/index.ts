import * as Events from "../events"
import * as Streams from "../streams"

export interface ClientFactory {
    createClient<T extends Endpoint>(options: ClientOptions<T>): Client<T>
}
export interface Client<T extends Endpoint> {
    readonly address: string
    readonly endpoint: T
    connection: Events.EventSource<Connection, this>
    close(): Promise<void>
    connect(): Promise<Connection>
}
export interface ClientOptions<T extends Endpoint> {
    address: string
    endpoint: T
}
export interface Connection extends Streams.ReadableWritablePair<Uint8Array, Uint8Array> {
    closed: Events.EventSource<void, this>
    close(): Promise<void>
}
export interface Endpoint {
    channel(connection: Connection): Promise<void>
}
export interface ServerFactory {
    createServer<T extends Endpoint>(options: ServerOptions<T>): Server<T>
}
export interface Server<T extends Endpoint> {
    connection: Events.EventSource<Connection, this>
    readonly address: string
    readonly endpoint: T
    close(): Promise<void>
    listen(): Promise<string>
}
export interface ServerOptions<T extends Endpoint> {
    endpoint: T
    address: string
}
export class Manager {
    private static clientFactories = new Set<ClientFactory>()
    private static serverFactories = new Set<ServerFactory>()
    static registerClientFactory(clientFactory: ClientFactory) { this.clientFactories.add(clientFactory) }
    static registerServerFactory(serverFactory: ServerFactory) { this.serverFactories.add(serverFactory) }
    static unregisterClientFactory(clientFactory: ClientFactory) { this.clientFactories.delete(clientFactory) }
    static unregisterServerFactory(serverFactory: ServerFactory) { this.serverFactories.delete(serverFactory) }
    static createClient<T extends Endpoint>(options: ClientOptions<T>): Client<T> {
        const errors = new Set<any>()
        for (const clientFactory of this.clientFactories) {
            try { return clientFactory.createClient(options) }
            catch (e) { errors.add(e) }
        }
        throw Error("No suitable client factory found for the given option set:\n".concat(errors.values.toString()))
    }
    static createServer<T extends Endpoint>(options: ServerOptions<T>): Server<T> {
        const errors = new Set<any>()
        for (const serverFactory of this.serverFactories) {
            try { return serverFactory.createServer(options) }
            catch (e) { errors.add(e) }
        }
        throw Error("No suitable server factory found for the given option set:\n".concat(errors.values.toString()))
    }
}