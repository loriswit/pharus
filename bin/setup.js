#!/usr/bin/env node

import { dirname, resolve } from "node:path"
import { spawnSync } from "node:child_process"

const projectRoot = resolve(import.meta.dirname, "..")
const debug = ["--verbose", "-v"].some(opt => process.argv.includes(opt))

try {
    console.log("> Installing dependencies")
    runNpm("ci")

    console.log("> Compiling source code")
    runNpm("run", "build")

    console.log("> Removing build cache")
    runNpm("prune", "--omit=dev")

    console.log("Setup complete\n")

    const puppeteer = await import("puppeteer")
    const browserPath = dirname(puppeteer.executablePath())
    console.log(`Notice: browser has been installed in ${browserPath}`)

    if (process.platform === "linux") {
        // print missing dependencies if any
        const { stdout } = spawnSync("ldd", [browserPath + "/chrome"])
        if (stdout) {
            const missingDeps = stdout.toString()
                .split("\n")
                .filter(line => line.includes("not found"))
                .map(line => line.match(/\s*(\S+)\s/)[1])

            if (missingDeps.length > 0) {
                console.warn("Warning: the following dependencies are missing and must be installed.")
                missingDeps.forEach(dep => console.warn(`  - ${dep}`))
            }
        }
    }

} catch (error) {
    console.error(`Error: ${error.message}`)
    if (debug) console.debug(error)
    process.exit(1)
}

function runNpm(...args) {
    const cmd = process.platform === "win32" ? "npm.cmd" : "npm"
    const { stdout, stderr, status } = spawnSync(cmd, args, { cwd: projectRoot, shell: true })

    if (debug) console.debug(stdout.toString())

    if (status !== 0)
        throw new Error(stderr.toString())
}
