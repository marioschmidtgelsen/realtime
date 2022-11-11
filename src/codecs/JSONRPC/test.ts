import { Consumer, Provider } from "."
import { expect } from "../../tests"

export async function testProviderConsumer() {
    function add(x: number, y: number) { return x + y }
    const consumer = new Consumer()
    const provider = new Provider()
    consumer.readable.pipeTo(provider.writable)
    provider.readable.pipeTo(consumer.writable)
    provider.expose(add)
    const result = await consumer.invoke("add", 23, 19)
    expect(result).equals(42)
}