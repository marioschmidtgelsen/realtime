export * as Generator from "./generator"

export enum TypeKind {
    Unknown = 0,
    Interface = 1,
    Primitive = 2
}
export interface Type {
    kind: TypeKind
    name: string
}
export enum MemberKind {
    Property = 1
}
export interface Member {
    kind: MemberKind
    name: string
    type: Type
}
export interface Property extends Member {
    kind: MemberKind.Property
}
export interface Primitive extends Type {
    kind: TypeKind.Primitive
}
export interface Interface extends Type {
    kind: TypeKind.Interface
    name: string
    members: Iterable<Member>
}

export function isType(value: any): value is Type {
    return typeof value == "object"
        && value.kind && typeof value.kind == "number"
        && value.name && typeof value.name == "string" && value.name.length > 0
}
export function isMember(value: any): value is Member {
    return typeof value == "object"
        && value.kind && typeof value.kind == "number"
        && value.name && typeof value.name == "string" && value.name.length > 0
        && value.type && isType(value.type)
}
export function isProperty(value: any): value is Property {
    return isMember(value)
        && value.kind == MemberKind.Property
}
export function isPrimitive(value: any): value is Primitive {
    return isType(value)
        && value.kind == TypeKind.Primitive
}
export function isInterface(value: any): value is Interface {
    return typeof value == "object"
        && value.members && typeof value.members == "object"
        && isType(value)
        && value.kind == TypeKind.Interface
}