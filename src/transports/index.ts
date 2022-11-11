import * as Events from "../events"
import * as Streams from "../streams"

export * as Http from "./Http"

export interface ClientFactory {
    createClient(options: ClientOptions): Client
}
export interface ClientOptions<I = any, O = any> {
    address: string
    endpoint: Endpoint<I, O>
}
export interface Client<I = any, O = any> {
    readonly address: string
    readonly endpoint: Endpoint<I, O>
    connection: Events.EventSource<Connection, this>
    close(): Promise<void>
    connect(): Promise<Connection>
}
export interface Connection extends Streams.ReadableWritablePair<any, any> {
    closed: Events.EventSource<void, this>
    close(): Promise<void>
}
export interface Endpoint<I = any, O = any> {
    channel(streams: Streams.ReadableWritablePair<I, O>): Promise<void>
}
export interface ServerOptions<I = any, O = any> {
    address: string
    endpoint: Endpoint<I, O>
}
export interface ServerFactory {
    createServer<I = any, O = any>(options: ServerOptions<I, O>): Server<I, O>
}
export interface Server<I = any, O = any> {
    connection: Events.EventSource<Connection, this>
    readonly address: string
    readonly endpoint: Endpoint<I, O>
    close(): Promise<void>
    listen(): Promise<this>
}
export class Manager {
    private static clientFactories = new Set<ClientFactory>()
    private static serverFactories = new Set<ServerFactory>()
    static registerClientFactory(clientFactory: ClientFactory) { this.clientFactories.add(clientFactory) }
    static registerServerFactory(serverFactory: ServerFactory) { this.serverFactories.add(serverFactory) }
    static unregisterClientFactory(clientFactory: ClientFactory) { this.clientFactories.delete(clientFactory) }
    static unregisterServerFactory(serverFactory: ServerFactory) { this.serverFactories.delete(serverFactory) }
    static createClient<I = any, O = any>(options: ClientOptions<I, O>): Client<I, O> {
        const errors = new Set<any>()
        for (const clientFactory of this.clientFactories) {
            try { return clientFactory.createClient(options) }
            catch (e) { errors.add(e) }
        }
        throw Error("No suitable client factory found for the given option set:\n".concat(errors.values.toString()))
    }
    static createServer<I = any, O = any>(options: ServerOptions<I, O>): Server<I, O> {
        const errors = new Set<any>()
        for (const serverFactory of this.serverFactories) {
            try { return serverFactory.createServer(options) }
            catch (e) { errors.add(e) }
        }
        throw Error("No suitable server factory found for the given option set:\n".concat(errors.values.toString()))
    }
}