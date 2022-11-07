import { createEmitter, EventSource, EventListener } from "../index"
import * as assert from "assert"

async function test() {
    class Channel {
        #message = createEmitter("message", this)
        constructor(readonly name: string) { }
        get message(): EventSource<string, this> { return this.#message }
        post(data: string) { this.#message.emit(data) }
    }
    var emitted: Array<string> = []
    const listener: EventListener<string> = (data) => emitted.push(data)
    const general = new Channel("general")
    const help = new Channel("help")
    general.message.on(listener)
    help.message.on(listener)
    general.post("foo")
    assert.deepStrictEqual(emitted.length, 1)
    assert.deepStrictEqual(emitted[0], "foo")
    help.post("bar")
    assert.deepStrictEqual(emitted.length, 2)
    assert.deepStrictEqual(emitted[1], "bar")
    const deleted = help.message.off(listener)
    assert.ok(deleted)
    help.post("baz")
    assert.deepStrictEqual(emitted.length, 2)
}

test().catch(console.error)