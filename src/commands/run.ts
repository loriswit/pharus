import { resolve } from "node:path"
import { existsSync } from "node:fs"
import puppeteer from "puppeteer"
import { checkDockerAvailable } from "../utils/helpers.js"
import { FlowMode } from "../flow.js"
import { drawPlot } from "./plot.js"
import { WebApp } from "../web-app.js"
import { type ReportSet } from "../report.js"

export interface RunFlowOptions {
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

    console.log("Launching headless browser")
    const browser = await puppeteer.launch({ headless: !headful })

    const reportSet: ReportSet = {}

    if (!patterns)
        patterns = app.patternList()

    for (const pattern of patterns) {
        try {
            const port = app.start(pattern)

            const url = `http://localhost:${port}`
            console.debug(`Web app is listening to ${url}`)

            console.log(`Running user flow: '${flowName}'`)
            reportSet[pattern] = await flow.run(browser, url, {
                name: `${appName}-${pattern}`,
                mode: FlowMode.Timespan,
                timeout: timeout * 1000,
                generateReport: { json: resolve(reportDir, `${pattern}.json`) },
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
