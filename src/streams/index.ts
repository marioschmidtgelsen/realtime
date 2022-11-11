export { ReadableStream, UnderlyingSource, ReadableStreamDefaultController } from "stream/web"
export { WritableStream, UnderlyingSink, WritableStreamDefaultController } from "stream/web"
export { TransformStream, Transformer, TransformStreamDefaultController } from "stream/web"
export { ReadableWritablePair } from "stream/web"
export { TextDecoderStream, TextEncoderStream } from "stream/web"

import { TransformStream } from "stream/web"

export class FilterStream<T = any> extends TransformStream<T> {
    constructor(predicate: (value: T) => boolean) {
        super({
            transform(chunk: T, controller: TransformStreamDefaultController<T>) {
                if (predicate(chunk)) controller.enqueue(chunk)
            }
        })
    }
}