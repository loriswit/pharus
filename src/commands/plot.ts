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

    console.log(`Plotting report '${report.metadata.name}'`)
    console.log(`  Device hostname: ${report.metadata.system?.hostname}`)
    console.log(`  Date: ${report.metadata.startDate?.toLocaleString()}`)
    if (report.metadata.startDate && report.metadata.endDate) {
        const duration = Math.round((report.metadata.endDate.getTime() - report.metadata.startDate.getTime()) / 60000)
        if (duration > 60)
            console.log(`  Duration: ${(duration / 60).toFixed(1)} hours`)
        else
            console.log(`  Duration: ${duration} minutes`)
    }
    console.log(`  Iterations: ${report.metadata.params?.iterations}`)
    console.log(`  CPU speed mult: ${report.metadata.params?.cpu}`)
    console.log(`  Network speed mult: ${report.metadata.params?.net}`)
    if (!report.metadata.success)
        console.warn("  Warning: errors occurred during report generation")

    console.log()
    console.debug("Full report metadata:\n", JSON.stringify(report.metadata, null, 2), "\n")

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
