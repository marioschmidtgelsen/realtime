export * as Node from "./node/index"

export interface Entry {
    readonly address: string
    readonly container?: Container
    readonly isContainer: boolean
    readonly name: string
}
export interface Container extends Entry, AsyncIterable<Entry> {
    readonly isContainer: true
    find(predicate: (entry: Entry) => boolean): AsyncIterable<Entry>
}
export interface File extends Entry {
    readonly container: Container
    readonly isContainer: false
}
export interface Directory extends Container {
    find(predicate: (entry: File | Directory) => boolean): AsyncIterable<File | Directory>
    findFiles(predicate: (entry: File) => boolean): AsyncIterable<File>
}