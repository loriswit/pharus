import { createInterface } from "node:readline"
import { execSync } from "node:child_process"
import { homedir } from "node:os"
import { resolve } from "node:path"
import { existsSync, rmSync } from "node:fs"
import { checkDockerAvailable } from "../utils/helpers.js"

export async function cleanCache({ force = false }) {
    checkDockerAvailable()

    if (!force) {
        console.warn("Warning: this operation will")
        console.warn("  - stop and remove every Pharus container")
        console.warn("  - delete every Pharus images")
        console.warn("  - remove the browser from the system")

        const cli = createInterface({
            input: process.stdin,
            output: process.stdout,
        })

        let answer = ""
        while (!["y", "yes", "n", "no"].includes(answer.toLowerCase()))
            answer = await new Promise<string>(resolve =>
                cli.question("Continue? (y/n) ", resolve))

        cli.close()
        if (answer === "n" || answer === "no") {
            console.log("Operation canceled")
            return
        }
    }

    // remove containers and images
    const dockerItems = [{
        type: "containers",
        listCommand: "docker ps -a --format \"{{.Names}}\"",
        removeCommand: "docker rm -f -v",
    }, {
        type: "images",
        listCommand: "docker images -a --format \"{{.Repository}}:{{.Tag}}\"",
        removeCommand: "docker rmi",
    }, {
        type: "volumes",
        listCommand: "docker volume ls --format \"{{.Name}}\"",
        removeCommand: "docker volume rm",
    }]

    for (const { type, listCommand, removeCommand } of dockerItems) {
        const stdout = execSync(listCommand)
        const items = stdout.toString().split("\n")
            .filter(item => item.startsWith(`${PKG_NAME}_`))
            // don't remove CLI container / image if currently running
            .filter(item => !IN_CONTAINER || !item.startsWith(`${PKG_NAME}_cli`))

        console.log(`Removing ${items.length} ${type}`)
        if (items.length) {
            const result = execSync(`${removeCommand} ${items.join(" ")}`)
            console.debug(result.toString())
        }
    }

    // remove browser
    const cacheDir = resolve(homedir(), ".cache", "puppeteer")
    if (existsSync(cacheDir)) {
        console.log("Removing browser")
        rmSync(cacheDir, { recursive: true })
        console.debug(cacheDir)
    }
}
