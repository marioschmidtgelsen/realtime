import * as Entities from "../manager"
import * as assert from "assert"

async function testManager() {
    interface Mock { key: number, foo: string }
    const isMock = (value: any): value is Mock => typeof value == "object" && "key" in value && typeof value.key == "number" && "foo" in value && typeof value.foo == "string"
    const keyGenerator: Entities.KeyGenerator = (entity) => isMock(entity) ? entity.key : entity
    const options = { keyGenerator }
    const manager = Entities.createManager(options)
    const attached: Array<Entities.AttachedEventData> = [], detached: Array<Entities.DetachedEventData> = [], merged: Array<Entities.MergedEventData> = []
    manager.attached.on((ev) => attached.push(ev.data))
    manager.detached.on((ev) => detached.push(ev.data))
    manager.merged.on((ev) => merged.push(ev.data))
    const entity = manager.attach({ key: 42, foo: "bar" })
    assert.deepStrictEqual(attached, [{ entity: { key: 42, foo: "bar" }}])
    const found = manager.find(42)
    assert.deepStrictEqual(found, { key: 42, foo: "bar" })
    entity.foo = "baz"
    assert.deepStrictEqual(merged, [{ key: 42, changes: { foo: "baz" }}])
    assert.deepStrictEqual(entity, { key: 42, foo: "baz" })
    assert.deepStrictEqual(entity, attached[0].entity)
    assert.deepStrictEqual(entity, found)
    manager.detach(entity)
    assert.deepStrictEqual(detached, [{ key: 42 }])
}

testManager().catch(console.error)