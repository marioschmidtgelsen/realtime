import * as Events from "../index"
import * as assert from "assert"

async function test() {
    class Channel {
        #message = new Events.Emitter("message", this)
        constructor(readonly name: string) { }
        get message(): Events.Event<string, this> { return this.#message }
        post(data: string) { this.#message.emit(data) }
    }
    var emitted: Array<Events.Message<string, Channel>> = []
    const listener: Events.Listener<string, Channel> = (data) => emitted.push(data)
    const general = new Channel("general")
    const help = new Channel("help")
    general.message.on(listener)
    help.message.on(listener)
    general.post("foo")
    assert.deepStrictEqual(emitted.length, 1)
    assert.deepStrictEqual(emitted[0].name, "message")
    assert.deepStrictEqual(emitted[0].source.name, "general")
    assert.deepStrictEqual(emitted[0].data, "foo")
    help.post("bar")
    assert.deepStrictEqual(emitted.length, 2)
    assert.deepStrictEqual(emitted[1].name, "message")
    assert.deepStrictEqual(emitted[1].source.name, "help")
    assert.deepStrictEqual(emitted[1].data, "bar")
    const deleted = help.message.off(listener)
    assert.ok(deleted)
    help.post("baz")
    assert.deepStrictEqual(emitted.length, 2)
}

test().catch(console.error)