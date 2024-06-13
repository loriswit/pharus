import { resolve } from "node:path"
import { readFileSync } from "node:fs"
import { type FlowResult } from "lighthouse"
import { getDeepProperty, resolvePath } from "./utils/helpers.js"

export type ReportSet = Record<string, FlowResult>

export interface Dataset {
    label: string
    data: (number | undefined)[]
}

export function loadReportSet(reportName: string, patterns: string | string[]): ReportSet {
    if (!Array.isArray(patterns)) patterns = [patterns]
    const reportDir = resolvePath(reportName, "reports")

    return Object.fromEntries((patterns as string[]).map(pattern => {
        const reportFile = resolve(reportDir, `${pattern}.json`)
        let report: FlowResult
        try {
            const json = readFileSync(reportFile, { encoding: "utf-8" })
            report = JSON.parse(json)
        } catch (e: any) {
            if (e instanceof SyntaxError)
                throw new Error(`failed to parse report for pattern '${pattern}': ${e.message} (${reportFile})`)
            if (e.code === "ENOENT")
                throw new Error(`report for pattern '${pattern}' is missing (${reportFile})`)
            else throw e
        }
        return [[pattern], report]
    }))
}

export function getMetricDatasets(reportSet: ReportSet, metric: string): Dataset[] {
    if (!metric.includes("."))
        metric += ".numericValue"

    return Object.entries(reportSet).map(([pattern, report]) => ({
        label: pattern,
        data: report.steps.map(step => getDeepProperty(step.lhr.audits, metric)),
    }))
}

export function getStepNames(reportSet: ReportSet): string[] {
    return Object.values(reportSet)[0].steps.map(step => step.name)
}
