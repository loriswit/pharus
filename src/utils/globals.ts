import { resolve } from "node:path"
import { readFileSync } from "node:fs"

declare global {
    var PKG_ROOT: string
    var PKG_NAME: string
    var PKG_VERSION: string
    var VERBOSE: boolean
}

globalThis.PKG_ROOT = resolve(import.meta.dirname, "..", "..")

const pkgJson = readFileSync(resolve(PKG_ROOT, "package.json"), "utf-8")
const pkg = JSON.parse(pkgJson)
globalThis.PKG_NAME = pkg.name
globalThis.PKG_VERSION = pkg.version

globalThis.VERBOSE = false

const logError = console.error
console.error = (...data) => logError("\x1b[31m" + data.join(" ") + "\x1b[0m")

const logWarning = console.warn
console.warn = (...data) => logWarning("\x1b[33m" + data.join(" ") + "\x1b[0m")

const logDebug = console.debug
console.debug = (...data) => VERBOSE && logDebug("\x1b[37m" + data.join(" ") + "\x1b[0m")
