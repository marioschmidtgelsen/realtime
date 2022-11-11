import * as Types from ".."
import { expect } from "../../tests"

export async function testGenerator() {
    const generator = new Types.Generator.Typescript()
    const sourceText = `interface Foo { bar: string }`
    const types = [...generator.importSourceText(sourceText)]
    expect(types).equals([{
        kind: Types.TypeKind.Interface,
        name: "Foo",
        members: [
            {
                kind: Types.MemberKind.Property,
                name: "bar",
                type: {
                    kind: Types.TypeKind.Primitive,
                    name: "string"
                }
            }
        ]
    }])
}