import * as Files from ".."
import * as fs from "fs/promises"

export function createDirectory(path: string) {
    return new Directory(path)
}

class Directory implements Files.Directory {
    constructor(readonly name: string, readonly container?: Directory) { }
    get address(): string { return this.container ? `${this.container.address}/${this.name}` : this.name }
    get isContainer(): true { return true }
    async *find(predicate: (entry: File | Directory) => boolean): AsyncIterable<File | Directory> {
        for await (const entry of this) {
            if (predicate(entry)) yield entry
            if (entry.isContainer) yield *entry.find(predicate)
        }
    }
    async *findFiles(predicate: (entry: File) => boolean): AsyncIterable<File> {
        for await (const entry of this) {
            if (!entry.isContainer) { if (predicate(entry)) yield entry }
            else yield *entry.findFiles(predicate)
        }
    }
    async *[Symbol.asyncIterator](): AsyncIterator<File | Directory> {
        const entries = await fs.readdir(this.address, { withFileTypes: true })
        for (const entry of entries) {
            if (entry.isDirectory()) yield new Directory(entry.name, this)
            else if (entry.isFile()) yield new File(entry.name, this)
        }
    }
}

class File implements Files.File {
    constructor(readonly name: string, readonly container: Directory) { }
    get address(): string { return `${this.container.address}/${this.name}` }
    get isContainer(): false { return false }
}

export function isFile(value: any): value is File {
    return value && typeof value == "object"
        && value.name && typeof value.name == "string" && value.name.length > 0
        && value.container && typeof value.container == "object"
        && value.isContainer && typeof value.isContainer == "boolean" && !value.isContainer
}
export function isDirectory(value: any): value is Directory {
    return value && typeof value == "object"
        && value.name && typeof value.name == "string" && value.name.length > 0
        && value.isContainer && typeof value.isContainer == "boolean" && value.isContainer
}