import { existsSync, readdirSync } from "node:fs"
import { resolve } from "node:path"
import { execSync } from "node:child_process"
import { createHash } from "node:crypto"
import { hasComposeFile, resolvePath } from "./utils/helpers.js"
import { type Flow } from "./flow.js"
import { FlowParserError, parseFlowFile } from "./flow-parser.js"

interface PatternStatus {
    running: boolean
    patternDir: string
    projectName: string
}

export class WebApp {
    private readonly name: string
    private readonly path: string

    private readonly status: Record<string, PatternStatus> = {}

    public constructor(name: string) {
        this.name = name

        this.path = resolvePath(name, "apps")
        if (!existsSync(this.path))
            throw new Error(`invalid app '${name}' (${this.path} does not exist)`)
    }

    public patternList(): string[] {
        const patternsDir = resolve(this.path, "patterns")
        const patterns = readdirSync(patternsDir)
        if (!patterns.length)
            throw new Error(`app '${this.name}' must provide at least one pattern (${patternsDir})`)
        return patterns
    }

    public loadFlow(flowName: string): Flow {
        const flowPath = resolve(this.path, "flows", `${flowName}.flow`)
        if (!existsSync(flowPath))
            throw new Error(`invalid flow '${flowName}' (${flowPath} does not exist)`)

        try {
            return parseFlowFile(flowPath)
        } catch (error) {
            if (error instanceof FlowParserError) {
                for (const e of error.errors)
                    console.error(`${e.file}:${e.line}:${e.col} error: ${e.message}`)
                throw new Error(`Failed to parse flow file (${flowPath})`)
            } else throw error
        }
    }

    public start(patternName: string): number {
        if (this.status[patternName]?.running)
            console.warn("Web app is already running")

        else {
            console.log(`Starting web app '${this.name}' with pattern '${patternName}'`)

            const patternDir = resolve(this.path, "patterns", patternName)
            if (!existsSync(patternDir))
                throw new Error(`failed to start web app (${patternDir} does not exist)`)
            if (!hasComposeFile(patternDir))
                throw new Error(`failed to start web app (${patternDir} is missing a compose file)`)

            const hash = createHash("md5").update(patternDir).digest("hex").slice(24)
            const projectName = `${PKG_NAME}_${this.name}_${patternName}_${hash}`

            // if running inside a container, provide host path to Docker Compose
            const projectDir = IN_CONTAINER ?
                [process.env.HOST_PATH, "apps", this.name, "patterns", patternName].join("/") :
                patternDir

            const stdout = execSync(
                `docker compose --project-name ${projectName} up --build --detach`,
                {
                    cwd: patternDir,
                    stdio: "pipe",
                    env: { ...process.env, PROJECT_DIR: projectDir },
                })

            console.debug(stdout)

            this.status[patternName] = { running: true, projectName, patternDir }
        }

        const address = execSync(
            `docker compose --project-name ${this.status[patternName].projectName} port web 8000`,
            { cwd: this.status[patternName].patternDir, stdio: "pipe" })

        return Number(address.toString().trim().split(":").pop())
    }

    public stop(patternName: string) {
        if (!this.status[patternName]?.running) {
            console.warn("Warning: web app is not running")
            return
        }

        console.log("Gracefully stopping web app")
        execSync(
            `docker compose --project-name ${this.status[patternName].projectName} down --volumes`,
            { cwd: this.status[patternName].patternDir, stdio: "ignore" })

        this.status[patternName].running = false
    }
}
