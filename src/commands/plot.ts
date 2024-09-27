import { existsSync, readdirSync } from "node:fs"
import { resolvePath } from "../utils/helpers.js"
import { Report } from "../report.js"
import { Plot } from "../plot.js"

export interface DrawPlotOptions {
    patterns: string[]
    steps: number[]
    truncate: number
    title: string
    legends: string[]
}

const metricAlts: Record<string, string> = {
    fcp: "first-contentful-paint",
    lcp: "largest-contentful-paint",
    tbt: "total-blocking-time",
    cls: "cumulative-layout-shift",
    "time-to-interactive": "interactive",
    tti: "interactive",
    "time-to-first-byte": "server-response-time",
    ttfb: "server-response-time",
    rtt: "network-rtt",
    inp: "interaction-to-next-paint",
}

export async function drawPlot(
    reportNameOrReport: string | Report,
    metric: string,
    {
        patterns,
        steps = [],
        truncate = 20,
        title,
        legends = []
    }: Partial<DrawPlotOptions>,
) {
    if (steps.some(step => step < 1))
        throw new Error(`the 'steps' option only supports positive integers`)

    if (!(truncate >= 0 && truncate <= 49))
        throw new Error(`the 'truncate' option must be a number between 0 and 49`)

    let report: Report

    if (typeof reportNameOrReport === "string") {
        const reportDir = resolvePath(reportNameOrReport, "reports")
        if (!existsSync(reportDir))
            throw new Error(`no such report (${reportDir})`)

        if (!patterns?.length)
            patterns = readdirSync(reportDir, { withFileTypes: true })
                .filter(entry => entry.isDirectory())
                .map(entry => entry.name)

        report = Report.load(reportNameOrReport, patterns)

    } else
        report = reportNameOrReport

    metric = metric.toLowerCase()
    metric = metricAlts[metric] ?? metric

    let stepsNames = report.getStepNames()
    const datasets = report.getMetricDatasets(metric, truncate / 100)
    const unit = report.getNumericUnit(metric)

    if (steps.length > 0) {
        stepsNames = stepsNames.filter((_, index) => steps.includes(index + 1))
        for (const dataset of datasets)
            dataset.data = dataset.data.filter((_, index) => steps.includes(index + 1))
    }

    for (const [index, value] of legends.entries())
        datasets[index].label = value

    const plot = new Plot(stepsNames, datasets, { title: title ?? metric, unit })
    await plot.displayInBrowser()
}
