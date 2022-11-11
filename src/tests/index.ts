import { File, Directory } from "../files"
import { createDirectory } from "../files/node"
import * as assert from "assert"
import { isPromise } from "util/types"

export interface Test extends Function { }
export interface Reference {
    readonly test: Test
    readonly file: File
}
export interface Expectation {
    equals(y: any): boolean
    ok(): void
}
export function expect(x: any): Expectation {
    return {
        equals(y: any) {
            assert.deepStrictEqual(x, y)
            return true
        },
        ok() {
            assert.ok(x)
        }
    }
}
export interface Result {
    test: Test
    success: boolean
}
export interface Failed extends Result {
    success: false
    error: Error
}
function isFailed(value: any): value is Failed {
    return value && typeof value == "object" && !value.success && value.error
}
export interface Success extends Result {
    success: true
}
export interface ScannerOptions {
    rootPath?: string
    fileMatcher?: (entry: File) => boolean
}
export class Scanner {
    protected rootDirectory: Directory
    protected fileMatcher: (entry: File) => boolean
    constructor(readonly options: ScannerOptions) {
        this.rootDirectory = createDirectory(options.rootPath || ".")
        this.fileMatcher = options.fileMatcher || ((file: File) => file.name == "test.js")
    }
    async *findFiles() {
        yield *this.rootDirectory.findFiles(this.fileMatcher)
    }
}
export interface LoaderOptions {
    moduleName: (path: string) => string
}
export class Loader {
    constructor(readonly options: LoaderOptions) { }
    async *importFunctions(sourceFile: File) {
        const module = await this.importModule(sourceFile)
        for (const member of Object.values(module)) {
            if (typeof member == "function") {
                yield member
            }
        }
    }
    async importModule(sourceFile: File) {
        return import(this.options.moduleName(sourceFile.address))
    }
}
export interface RunnerOptions { }
export class Runner {
    async runTest(test: Test): Promise<Result> {
        try {
            const result = test.call(undefined)
            if (isPromise(result)) return result.then(() => ({ test, success: true }))
            else return Promise.resolve({ test, success: true })
        } catch (error) {
            return Promise.resolve({ test, success: false, error } as Failed)
        }
    }
}
export class Printer {
    async printResult(result: Result) {
        if (result.success) console.info(result.test.name)
        else if (isFailed(result)) { console.error(`${result.test.name}: ${result.error}`) }
    }
    async printSummary() {
    }
}