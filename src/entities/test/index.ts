import { createManager, KeyGenerator, AttachedEventData, DetachedEventData, MergedEventData } from "../manager"
import * as assert from "assert"

async function testManager() {
    interface Mock { key: number, foo: string }
    const isMock = (value: any): value is Mock => typeof value == "object" && "key" in value && typeof value.key == "number" && "foo" in value && typeof value.foo == "string"
    const keyGenerator: KeyGenerator = (entity) => isMock(entity) ? entity.key : entity
    const options = { keyGenerator }
    const manager = createManager(options)
    const attached: Array<AttachedEventData> = [], detached: Array<DetachedEventData> = [], merged: Array<MergedEventData> = []
    manager.attached.on(({ data }) => attached.push(data))
    manager.detached.on(({ data }) => detached.push(data))
    manager.merged.on(({ data }) => merged.push(data))
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