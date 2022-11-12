import * as Codecs from "../codecs"
import * as Streams from "../streams"
import * as Transports from "../transports"

export class WebService<T extends object> implements Transports.Http.Server.Endpoint {
    protected methods: Array<WebMethod<T>>
    constructor(readonly instance: T) {
        this.methods = Registry.getDescriptors(instance).map(descriptor => new WebMethod(this, descriptor))
    }
    async channel({ readable, writable }: Transports.Connection) {
        const self = this
        readable.pipeTo(new Streams.WritableStream<Transports.Http.Server.Request>({
            async write(request) {
                const method = self.getWebMethod(request)
                if (method) {
                    new Streams.ReadableStream({
                        start(controller) {
                            const result = method.invoke(request)
                            controller.enqueue(result)
                            controller.close()
                        }
                    })
                    .pipeThrough(new Codecs.JSON.EncoderStream())
                    .pipeThrough(new Streams.TextEncoderStream())
                    .pipeTo(writable)
                }
            }
        }))
    }
    protected getWebMethod(request: Transports.Http.Server.Request) {
        for (const method of this.methods) {
            if (request.url == "/".concat(method.descriptor.propertyKey.toString())) {
                return method
            }
        }
    }
}

export function Get<T>(target: Object, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<T>): TypedPropertyDescriptor<T> | void {
    Registry.registerDescriptor(target, propertyKey, descriptor)
}

export interface WebMethodDescriptor<T = any> {
    target: Object
    propertyKey: string | symbol
    descriptor: TypedPropertyDescriptor<T>
}

export class WebMethod<T extends object> {
    readonly method: Function
    constructor(readonly service: WebService<T>, readonly descriptor: WebMethodDescriptor) {
        this.method = this.descriptor.descriptor.value!
    }
    invoke(request: Transports.Http.Server.Request) {
        return this.method.call(this.service.instance, request)
    }
}

class Registry {
    private static descriptors = new Array<WebMethodDescriptor>()
    static registerDescriptor<T>(target: Object, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<T>): TypedPropertyDescriptor<T> | void {
        this.descriptors.push({ target, propertyKey, descriptor: descriptor })
    }
    static getDescriptors(target: Object): Array<WebMethodDescriptor> {
        return this.descriptors.filter(descriptor => descriptor.target == target.constructor.prototype)
    }
}