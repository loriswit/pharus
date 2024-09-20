import { resolve } from "node:path"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { checkDockerAvailable, launchBrowser } from "../utils/helpers.js"
import { FlowMode } from "../flow.js"
import { drawPlot } from "./plot.js"
import { WebApp } from "../web-app.js"
import { Report } from "../report.js"

export interface RunFlowOptions {
    iterations: number
    patterns: string[]
    plot: string
    save: string
    cpu: number
    net: number
    timeout: number
    headful: boolean
}

export async function runFlow(
    appName: string,
    flowName: string,
    {
        iterations = 10,
        patterns,
        plot,
        save,
        cpu = 1,
        net = 1,
        timeout = 20,
        headful = false,
    }: Partial<RunFlowOptions> = {},
) {
    // validate options
    for (const arg of ["iterations", "cpu", "net", "timeout"])
        if (arg in arguments[2] && !(arguments[2][arg] > 0))
            throw new Error(`the '${arg}' option must be a positive number`)

    if (save?.length === 0)
        throw new Error(`the 'save' option must not be an empty string`)

    checkDockerAvailable()

    const app = new WebApp(appName)
    const flow = app.loadFlow(flowName)

    const reportName = save ??
        new Date().toISOString()
            .replaceAll("T", "_")
            .replaceAll(":", "-")
            .slice(0, 19)
        + `_${appName}_${flowName}`

    const reportDir = resolve(PKG_ROOT, "reports", reportName)
    if (existsSync(reportDir))
        throw new Error(`report directory already exists (${reportDir})`)

    console.log(`Launching ${headful ? "headful" : "headless"} browser`)
    const browser = await launchBrowser({
        headless: !headful,
        args: BROWSER_ARGS,
    })

    const report = new Report()

    if (!patterns)
        patterns = app.patternList()

    const metadata = {
        name: save,
        success: false,
        params: { iterations, patterns, plot, cpu, net, timeout },
        startDate: new Date().toISOString(),
        endDate: undefined as string | undefined,
        pharusVersion: PKG_VERSION,
        originalPath: reportDir,
        cmdLine: process.argv.join(" "),
        errors: undefined as string[] | undefined,
    }

    mkdirSync(reportDir, { recursive: true })
    writeFileSync(resolve(reportDir, "meta.json"), JSON.stringify(metadata, null, 2))

    try {
        for (let i = 0; i < iterations; i++)
            for (const pattern of patterns) {
                try {
                    const port = app.start(pattern)
                    process.on("SIGINT", () => app.stop(pattern))

                    const hostname = IN_CONTAINER ? "host.docker.internal" : "localhost"

                    const url = `http://${hostname}:${port}`
                    console.debug(`Web app is listening to ${url}`)

                    const reportFilename = String(i + 1).padStart(Math.floor(Math.log10(iterations) + 1), "0")

                    console.log(`Running user flow: '${flowName}' (${i + 1} / ${iterations})`)
                    const result = await flow.run(browser, url, {
                        name: `${appName}-${pattern}`,
                        mode: FlowMode.Timespan,
                        timeout: timeout * 1000,
                        generateReport: { json: resolve(reportDir, pattern, `${reportFilename}.json`) },
                        settings: {
                            throttling: {
                                cpuSlowdownMultiplier: 4 / cpu,
                                requestLatencyMs: 150,
                                throughputKbps: 1600 * net,
                                downloadThroughputKbps: 1600 * net,
                                uploadThroughputKbps: 750 * net,
                            },
                        },
                    })
                    report.pushFlowResult(pattern, result)

                } catch (error) {
                    if (error instanceof Error) {
                        if (!metadata.errors)
                            metadata.errors = []
                        metadata.errors.push(error.message)
                    }
                    throw error
                } finally {
                    app.stop(pattern)
                }
            }

        metadata.success = true

    } finally {
        metadata.endDate = new Date().toISOString()
        writeFileSync(resolve(reportDir, "meta.json"), JSON.stringify(metadata, null, 2))

        console.log("Closing browser")
        await browser.close()

        console.log(`Report saved as '${reportName}' (${reportDir})`)
    }

    if (plot)
        await drawPlot(report, plot, { patterns })
}
