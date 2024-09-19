import { readdirSync } from "node:fs"
import { resolvePath } from "../utils/helpers.js"
import { getMetricDatasets, getStepNames, loadReportSet, type ReportSet } from "../report.js"
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
    reportNameOrSet: string | ReportSet,
    metric: string,
    { patterns, title, truncate = 20, legends = [] }: Partial<DrawPlotOptions>,
) {
    if (!(truncate >= 0 && truncate <= 49))
        throw new Error(`the 'truncate' option must be a number between 0 and 49`)

    let reportSet: ReportSet

    if (typeof reportNameOrSet === "string") {
        if (!patterns?.length)
            patterns = readdirSync(resolvePath(reportNameOrSet, "reports"), { withFileTypes: true })
                .filter(entry => entry.isDirectory())
                .map(entry => entry.name)

        reportSet = loadReportSet(reportNameOrSet, patterns)

    } else
        reportSet = reportNameOrSet

    metric = metric.toLowerCase()
    metric = metricAlts[metric] ?? metric

    const stepsNames = getStepNames(reportSet)
    const datasets = getMetricDatasets(reportSet, metric, truncate / 100)

    for (const [index, value] of legends.entries())
        datasets[index].label = value

    const plot = new Plot(stepsNames, datasets, { title: title ?? metric })
    await plot.displayInBrowser()
}
