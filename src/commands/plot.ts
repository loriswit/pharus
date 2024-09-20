import { readdirSync } from "node:fs"
import { resolvePath } from "../utils/helpers.js"
import { Report } from "../report.js"
import { Plot } from "../plot.js"

export interface DrawPlotOptions {
    patterns: string[]
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
    { patterns, title, truncate = 20, legends = [] }: Partial<DrawPlotOptions>,
) {
    if (!(truncate >= 0 && truncate <= 49))
        throw new Error(`the 'truncate' option must be a number between 0 and 49`)

    let report: Report

    if (typeof reportNameOrReport === "string") {
        if (!patterns?.length)
            patterns = readdirSync(resolvePath(reportNameOrReport, "reports"), { withFileTypes: true })
                .filter(entry => entry.isDirectory())
                .map(entry => entry.name)

        report = Report.load(reportNameOrReport, patterns)

    } else
        report = reportNameOrReport

    metric = metric.toLowerCase()
    metric = metricAlts[metric] ?? metric

    const stepsNames = report.getStepNames()
    const datasets = report.getMetricDatasets(metric, truncate / 100)
    const unit = report.getNumericUnit(metric)

    for (const [index, value] of legends.entries())
        datasets[index].label = value

    const plot = new Plot(stepsNames, datasets, { title: title ?? metric, unit })
    await plot.displayInBrowser()
}
