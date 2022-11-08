import * as Tests from "."

async function main() {
    const scanner = new Tests.Scanner({ rootPath: "./dist" })
    const loader = new Tests.Loader({ moduleName: (path) => path.replace("./dist/", "../") })
    const runner = new Tests.Runner()
    const printer = new Tests.Printer()
    for await (const file of scanner.findFiles()) {
        for await (const test of loader.importFunctions(file)) {
            const result = await runner.runTest(test)
            printer.printResult(result)
        }
    }
}

main().catch(console.error)