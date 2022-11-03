import * as Remotes from "./remotes/index"

async function main() {
    const client = new Remotes.JSONRPC.Client()
    await client.connect(3000)
    await client.invoke("merge", 42, { foo: "bar" })
    await client.close()
}

main().catch(console.error)