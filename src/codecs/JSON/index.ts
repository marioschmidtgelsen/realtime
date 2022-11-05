import { TransformStream, Transformer, TransformStreamDefaultController } from "../../streams"

export class DecoderStream<T = any> extends TransformStream<string, T> {
    constructor() { super(new DecoderTransformer()) }
}
class DecoderTransformer<T = any> implements Transformer<string, T> {
    transform(chunk: string, controller: TransformStreamDefaultController<T>) {
        const decoded: T = JSON.parse(chunk)
        controller.enqueue(decoded)
    }
}
export class EncoderStream<T = any> extends TransformStream<T, string> {
    constructor() { super(new EncoderTransformer()) }
}
class EncoderTransformer<T = any> implements Transformer<T, string> {
    transform(chunk: T, controller: TransformStreamDefaultController<string>) {
        const encoded = JSON.stringify(chunk)
        controller.enqueue(encoded)
    }
}