import * as Types from ".."
import * as typescript from "typescript"
import * as fs from "fs"

export class Typescript {
    *importSourceFile(fileName: string) {
        const sourceText = fs.readFileSync(fileName, { encoding: "utf8" })
        yield *this.importSourceText(sourceText, fileName)
    }
    *importSourceText(sourceText: string, fileName = "__temp__.ts") {
        const sourceFile = typescript.createSourceFile(fileName, sourceText, typescript.ScriptTarget.Latest)
        const transformer = new TypeVisitor()
        yield *transformer.visit(sourceFile)
    }
}
class TypeVisitor {
    protected sourceFile?: typescript.SourceFile
    protected interface?: Types.Interface
    protected members?: Array<Types.Member>
    protected property?: Types.Property
    protected propertyName?: string
    protected type?: Types.Type
    *visit(node: typescript.Node): Generator<Types.Interface> {
        if (!node) return
        if (typescript.isSourceFile(node)) yield *this.visitSourceFile(node)
        else if (typescript.isInterfaceDeclaration(node)) yield *this.visitInterfaceDeclaration(node)
        else if (typescript.isPropertySignature(node)) yield *this.visitPropertySignature(node)
        else if (typescript.isPropertyName(node)) yield *this.visitPropertyName(node)
        else if (typescript.isTypeNode(node)) yield *this.visitTypeNode(node)
        else yield *this.visitChildNodes(node)
    }
    protected *visitSourceFile(node: typescript.SourceFile): Generator<Types.Interface> {
        yield *this.visitChildNodes(this.sourceFile = node)
    }
    protected *visitInterfaceDeclaration(node: typescript.InterfaceDeclaration): Generator<Types.Interface> {
        yield *this.visitChildNodes(node)
        const name = node.name.getText(this.sourceFile!)
        const members = this.members!
        yield this.interface = { kind: Types.TypeKind.Interface, name, members }
    }
    protected *visitPropertySignature(node: typescript.PropertySignature): Generator<Types.Interface> {
        yield *this.visitChildNodes(node)
        const name = this.propertyName!
        const type = this.type!
        const property = { kind: Types.MemberKind.Property, name, type }
        this.members = this.members ? [...this.members, property] : [property]
    }
    protected *visitPropertyName(node: typescript.PropertyName): Generator<Types.Interface> {
        yield *this.visitChildNodes(node)
        this.propertyName = node.getText(this.sourceFile!)
    }
    protected *visitTypeNode(node: typescript.TypeNode): Generator<Types.Interface> {
        yield *this.visitChildNodes(node)
        const name = node.getText(this.sourceFile!)
        this.type = { kind: Types.TypeKind.Primitive, name }
    }
    protected *visitChildNodes(node: typescript.Node): Generator<Types.Interface> {
        const nodes = node.getChildren(this.sourceFile!)
        for (const node of nodes) yield *this.visit(node)
    }
}