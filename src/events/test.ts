import { createEmitter, EventSource, EventListener } from "./index"
import { expect } from "../tests"

export async function testEventEmitter() {
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
    expect(emitted).equals(["foo"])
    help.post("bar")
    expect(emitted).equals(["foo", "bar"])
    const deleted = help.message.off(listener)
    expect(deleted).equals(true)
    help.post("baz")
    expect(emitted.length).equals(2)
}