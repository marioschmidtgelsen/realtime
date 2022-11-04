import { TransformStream, Transformer } from "../../streams"

export class JSONDecoderStream<T = any> extends TransformStream<string, T> {
    constructor() { super(new JSONDecoderTransformer()) }
}
class JSONDecoderTransformer<T = any> implements Transformer<string, T> {
    transform(chunk: string, controller: TransformStreamDefaultController<T>) {
        const decoded: T = JSON.parse(chunk)
        controller.enqueue(decoded)
    }
}
export class JSONEncoderStream<T = any> extends TransformStream<T, string> {
    constructor() { super(new JSONEncoderTransformer()) }
}
class JSONEncoderTransformer<T = any> implements Transformer<T, string> {
    transform(chunk: T, controller: TransformStreamDefaultController<string>) {
        const encoded = JSON.stringify(chunk)
        controller.enqueue(encoded)
    }
}