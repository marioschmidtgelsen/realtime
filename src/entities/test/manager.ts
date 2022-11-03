import * as Entities from "../manager"
import * as assert from "assert"

async function testManager() {
    interface Mock { key: number, foo: string }
    const isMock = (value: any): value is Mock => typeof value == "object" && "key" in value && typeof value.key == "number" && "foo" in value && typeof value.foo == "string"
    const keyGenerator: Entities.KeyGenerator = (entity) => isMock(entity) ? entity.key : entity
    const options = { keyGenerator }
    const manager = new Entities.Manager(options)
    const attached: Array<{ entity: object }> = [], detached: Array<{ key: any }> = [], merged: Array<{ key: any, changes: object }> = []
    manager.on("attach", (entity) => attached.push({ entity }))
    manager.on("detach", (key) => detached.push({ key }))
    manager.on("merge", (key, changes) => merged.push({ key, changes}))
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