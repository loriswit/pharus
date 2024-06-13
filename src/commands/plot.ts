import { readdirSync } from "node:fs"
import { resolvePath } from "../utils/helpers.js"
import { getMetricDatasets, getStepNames, loadReportSet, type ReportSet } from "../report.js"
import { Plot } from "../plot.js"

export interface DrawPlotOptions {
    patterns: string[]
    title: string
}

const metricAlts: Record<string, string> = {
    fcp: "first-contentful-paint",
    lcp: "largest-contentful-paint",
    tbt: "total-blocking-time",
    cls: "cumulative-layout-shift",
    tti: "interactive",
    "time-to-first-byte": "server-response-time",
    ttfb: "server-response-time",
    rtt: "network-rtt",
    inp: "interaction-to-next-paint",
}

export async function drawPlot(
    reportNameOrSet: string | ReportSet,
    metric: string,
    { patterns, title }: Partial<DrawPlotOptions>,
) {
    let reportSet: ReportSet

    if (typeof reportNameOrSet === "string") {
        if (!patterns?.length)
            patterns = readdirSync(resolvePath(reportNameOrSet, "reports"))
                .map(filename => filename.replace(/\.json$/, ""))

        reportSet = loadReportSet(reportNameOrSet, patterns)

    } else
        reportSet = reportNameOrSet

    metric = metric.toLowerCase()
    metric = metricAlts[metric] ?? metric

    const stepsNames = getStepNames(reportSet)
    const datasets = getMetricDatasets(reportSet, metric)

    const plot = new Plot(stepsNames, datasets, { title: title ?? metric })
    await plot.displayInBrowser()
}
