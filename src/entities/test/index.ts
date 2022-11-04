import { createManager, KeyGenerator, AttachedEventData, DetachedEventData, MergedEventData } from "../manager"
import * as assert from "assert"

function tearUp() {
    interface Mock { key: number, foo: string }
    const isMock = (value: any): value is Mock => typeof value == "object" && "key" in value && typeof value.key == "number" && "foo" in value && typeof value.foo == "string"
    const keyGenerator: KeyGenerator = (entity) => isMock(entity) ? entity.key : entity
    const options = { keyGenerator }
    const manager = createManager(options)
    return manager
}

async function testAttachFindMergeDetach() {
    const manager = tearUp()
    const attached: Array<AttachedEventData> = [], detached: Array<DetachedEventData> = [], merged: Array<MergedEventData> = []
    manager.attached.on(({ data }) => attached.push(data))
    manager.detached.on(({ data }) => detached.push(data))
    manager.merged.on(({ data }) => merged.push(data))
    manager.attach({ key: 42, foo: "bar" })
    assert.deepStrictEqual(attached, [{ entity: { key: 42, foo: "bar" }}])
    const entity = manager.find(42)
    assert.deepStrictEqual(entity, { key: 42, foo: "bar" })
    manager.merge(entity, { foo: "baz"})
    assert.deepStrictEqual(merged, [{ key: 42, changes: { foo: "baz" }}])
    assert.deepStrictEqual(entity, { key: 42, foo: "baz" })
    assert.deepStrictEqual(entity, attached[0].entity)
    manager.detach(entity)
    assert.deepStrictEqual(detached, [{ key: 42 }])
}

async function testSubscribeUnsubscribe() {
    const manager = tearUp()
    const entity = manager.attach({ key: 42, foo: "foo" })
    const subscription = manager.subscribe(entity)
    const consumed: Array<MergedEventData | DetachedEventData> = []
    subscription.detached.on(({ data }) => consumed.push(data))
    subscription.merged.on(({ data }) => consumed.push(data))
    entity.foo = "bar"
    entity.foo = "baz"
    subscription.unsubscribe()
    entity.foo = "foo"
    assert.deepStrictEqual(consumed, [{ key: 42, changes: { foo: "bar" } }, { key: 42, changes: { foo: "baz" } }])
}

async function test() {
    return Promise.all([
        testAttachFindMergeDetach(),
        testSubscribeUnsubscribe(),
    ])
}

test().catch(console.error)