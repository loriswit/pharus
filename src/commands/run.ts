import { resolve } from "node:path"
import { existsSync } from "node:fs"
import puppeteer from "puppeteer"
import { checkDockerAvailable } from "../utils/helpers.js"
import { FlowMode } from "../flow.js"
import { drawPlot } from "./plot.js"
import { WebApp } from "../web-app.js"
import { type ReportSet } from "../report.js"

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
    const browser = await puppeteer.launch({
        headless: !headful,
        args: BROWSER_ARGS,
    })

    const reportSet: ReportSet = {}

    if (!patterns)
        patterns = app.patternList()

    for (let i = 0; i < iterations; i++)
        for (const pattern of patterns) {
            if (!reportSet[pattern])
                reportSet[pattern] = []

            try {
                const port = app.start(pattern)
                const hostname = IN_CONTAINER ? "host.docker.internal" : "localhost"

                const url = `http://${hostname}:${port}`
                console.debug(`Web app is listening to ${url}`)

                const reportFilename = String(i + 1).padStart(Math.floor(Math.log10(iterations) + 1), "0")

                console.log(`Running user flow: '${flowName}' (${i + 1} / ${iterations})`)
                reportSet[pattern].push(await flow.run(browser, url, {
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
                }))

            } finally {
                app.stop(pattern)
            }
        }

    console.log("Closing browser")
    await browser.close()

    console.log(`Report saved as '${reportName}' (${reportDir})`)

    if (plot)
        await drawPlot(reportSet, plot, { patterns })
}
