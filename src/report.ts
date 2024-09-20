import { resolve } from "node:path"
import { readdirSync, readFileSync } from "node:fs"
import { type FlowResult } from "lighthouse"
import { getDeepProperty, resolvePath } from "./utils/helpers.js"

export type ReportSet = Record<string, FlowResult[]>

export interface Dataset {
    label: string
    data: {
        y: number,
        yMax?: number,
        yMin?: number,
    }[]
}

export class Report {
    private readonly reportSet: ReportSet

    constructor(reportSet = {}) {
        this.reportSet = reportSet
    }

    public static load(reportName: string, patterns: string | string[]): Report {
        if (!Array.isArray(patterns)) patterns = [patterns]
        const reportDir = resolvePath(reportName, "reports")

        return new this(Object.fromEntries(patterns.map(pattern => {
            const patternDir = resolve(reportDir, pattern)
            const reportFiles = []

            try {
                reportFiles.push(...readdirSync(patternDir).filter(file => file.match(/^\d+\.json$/)))
            } catch (e: any) {
                if (e.code === "ENOENT")
                    throw new Error(`pattern '${pattern}' is missing from report (${patternDir})`)
                else throw e
            }

            const reports: FlowResult[] = []
            for (const reportFile of reportFiles) {
                try {
                    const index = Number(reportFile.match(/\d+/)?.[0]) - 1
                    const json = readFileSync(resolve(patternDir, reportFile), { encoding: "utf-8" })
                    reports[index] = JSON.parse(json)
                } catch (e: any) {
                    if (e instanceof SyntaxError)
                        throw new Error(`failed to parse report for pattern '${pattern}': ${e.message} (${reportFile})`)
                    if (e.code === "ENOENT")
                        throw new Error(`report for pattern '${pattern}' is missing (${reportFile})`)
                    else throw e
                }
            }
            return [pattern, reports]
        })
            // only keep patterns that have at least one report
            .filter(([_, reports]) => reports.length > 0)))
    }

    public pushFlowResult(pattern: string, flowResult: FlowResult) {
        if (!this.reportSet[pattern])
            this.reportSet[pattern] = []

        this.reportSet[pattern].push(flowResult)
    }

    public getMetricDatasets(metric: string, truncate: number = 0): Dataset[] {
        if (!metric.includes("."))
            metric += ".numericValue"

        // compute number of discarded values, according to truncation ratio
        const initReportsCount = Object.values(this.reportSet)[0].length
        const discarded = Math.min(Math.floor(initReportsCount * truncate), Math.ceil(initReportsCount / 2) - 1)
        const finaleReportsCount = initReportsCount - discarded * 2

        console.log(`Generating datasets (${Math.round(truncate * 100)}% truncated mean)`)

        return Object.entries(this.reportSet).map(([pattern, reports]) => ({
            label: pattern,
            data: reports[0].steps.map((_, index) => reports
                .map(report =>
                    getDeepProperty(report.steps[index].lhr.audits, metric) ?? NaN)  // fetch property
                .toSorted()                                                          // sort values
                .slice(discarded, initReportsCount - discarded)                      // truncate
                .reduce((acc, x) => ({
                    y: acc.y + x / finaleReportsCount,      // compute mean value
                    yMax: x > acc.yMax ? x : acc.yMax,      // compute max value
                    yMin: x < acc.yMin ? x : acc.yMin,      // compute min value
                }), { y: 0, yMax: 0, yMin: Infinity })),
        }))
    }

    public getStepNames(): string[] {
        return Object.values(this.reportSet)[0][0].steps.map(step => step.name)
    }

    public getNumericUnit(metric: string): string | undefined {
        metric += ".numericUnit"
        const result = Object.values(this.reportSet)[0][0]
        for (const step of result.steps) {
            const unit = getDeepProperty<string>(step.lhr.audits, metric)
            if (unit) return unit
        }
        return undefined
    }
}
