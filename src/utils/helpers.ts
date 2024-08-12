import { resolve } from "node:path"
import { execSync } from "node:child_process"
import { existsSync } from "node:fs"

/**
 * Returns the value of a property inside nested objects.
 * @param object The root object
 * @param deepProperty Nested properties as a string, e.g. "a.b.c"
 */
export function getDeepProperty<T = number>(
    object: Record<string, any>,
    deepProperty: string,
): T | undefined {
    return deepProperty.split(".")
        .reduce((obj, property) => obj && obj[property], object) as T | undefined
}

/**
 * If path doesn't contain a slash, resolve path from specified default directory
 */
export function resolvePath(path: string, defaultDir: string): string {
    return path.match(/[\/\\]/) ? resolve(path) : resolve(PKG_ROOT, defaultDir, path)
}

/**
 * Throws an error if Docker is not available.
 */
export function checkDockerAvailable(): void {
    try {
        execSync("docker -v", { stdio: "ignore" })
    } catch (_) {
        throw new Error("the docker command is not available")
    }

    try {
        execSync("docker info", { stdio: "ignore" })
    } catch (e: any) {
        if (e.status === 130 || e.status >= 255) // process exited unusually
            throw e

        throw new Error("the docker daemon is either not running or you don't have sufficient permissions")
    }
}

/**
 * Returns true if the target directory contains a valid Docker Compose file
 */
export function hasComposeFile(path: string): boolean {
    const allowedFilenames = [
        "compose.yaml", "compose.yml",
        "docker-compose.yaml", "docker-compose.yml",
    ]

    return allowedFilenames
        .some(filename => existsSync(resolve(path, filename)))
}
