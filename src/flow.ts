import { mkdirSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { setTimeout as sleep } from "node:timers/promises"
import { Browser, Page } from "puppeteer"
import { type FlowResult, type SharedFlagsSettings, startFlow, type UserFlow } from "lighthouse"

export enum FlowMode { Navigation, Timespan }

export interface FlowConfig {
    mode: FlowMode
    name: string
    timeout: number
    waitForIdle: boolean
    printProgress: boolean
    settings: SharedFlagsSettings
    generateReport: {
        json?: string
        html?: string
    }
}

export interface Step<K extends keyof FlowRunner> {
    type: K
    params: Parameters<FlowRunner[K]>
}

export type FlowStep = Step<keyof FlowRunner>

export class Flow {
    private readonly steps: FlowStep[]

    public constructor(steps: FlowStep[] = []) {
        this.steps = steps
    }

    public async run(browser: Browser,
                     url: string,
                     {
                         mode = FlowMode.Navigation,
                         name,
                         timeout,
                         waitForIdle,
                         printProgress = false,
                         settings,
                         generateReport = {},
                     }: Partial<FlowConfig>,
    ): Promise<FlowResult> {
        const page = await browser.newPage()

        const userFlow = await startFlow(page, {
            flags: {
                logLevel: "warn",
                output: "html",
                onlyCategories: ["performance"],
            },
            config: {
                extends: "lighthouse:default",
                settings: settings,
            },
            name: name,
        })

        if (timeout)
            page.setDefaultTimeout(timeout)

        let idleTime = undefined
        if (waitForIdle) {
            idleTime = Math.min(3000000 / (settings?.throttling?.throughputKbps ?? 1500), 10000)
            console.debug(`Minimum network idle time: ${idleTime} ms`)
        }

        // auto-accept dialog boxes
        page.on("dialog", async dialog => await dialog.accept())

        await userFlow.startNavigation({ name: "Initial page load" })
        await page.goto(url)
        if (waitForIdle)
            await page.waitForNetworkIdle({ idleTime })
        await userFlow.endNavigation()

        const runner = new FlowRunner(mode, page, userFlow, { idleTime }) as Record<keyof FlowRunner, Function>

        try {
            for (const [index, step] of this.steps.entries()) {
                if (printProgress)
                    process.stdout.write(`\r\x1b[36m> step ${index + 1} / ${this.steps.length}\x1b[0m`)
                await runner[step.type](...step.params)
            }
        } finally {
            if (printProgress)
                // clear line
                process.stdout.write(`\r${" ".repeat(process.stdout.columns)}\r`)
        }

        const result = await userFlow.createFlowResult()
        await page.close()

        if (generateReport?.json) {
            mkdirSync(dirname(generateReport.json), { recursive: true })
            writeFileSync(generateReport.json, JSON.stringify(result, null, 2))
        }

        if (generateReport?.html) {
            mkdirSync(dirname(generateReport.html), { recursive: true })
            writeFileSync(generateReport.html, await userFlow.generateReport())
        }

        return result
    }
}

interface FlowRunnerOptions {
    idleTime: number
}

class FlowRunner {
    private readonly mode: FlowMode
    private readonly page: Page
    private readonly userFlow: UserFlow
    private readonly options: Partial<FlowRunnerOptions>

    public constructor(mode: FlowMode, page: Page, userFlow: UserFlow, options: Partial<FlowRunnerOptions> = {}) {
        this.mode = mode
        this.page = page
        this.userFlow = userFlow
        this.options = options
    }

    public async click(selector: string) {
        console.debug(`FlowRunner.click | ${selector}`)
        const element = await this.page.waitForSelector(selector)
        await element?.click()
    }

    public async select(selector: string, value: string) {
        console.debug(`FlowRunner.select | ${selector} | ${value}`)
        await this.page.select(selector, value)
    }

    public async type(selector: string, value: string) {
        console.debug(`FlowRunner.type | ${selector} | ${value}`)
        await this.page.type(selector, value)
    }

    public async scroll(selector: string) {
        console.debug(`FlowRunner.scroll | ${selector}`)
        const element = await this.page.waitForSelector(selector)
        await element?.scrollIntoView()

        // wait for potential hydration
        const slowdown = this.userFlow._options?.config?.settings?.throttling?.cpuSlowdownMultiplier ?? 1
        await sleep(200 * slowdown)

        this.page.waitForNetworkIdle()
    }

    public async begin(value: string) {
        console.debug(`FlowRunner.begin | ${value}`)
        if (this.mode === FlowMode.Timespan)
            await this.userFlow.startTimespan({ name: value })
        else
            await this.userFlow.startNavigation({ name: value })
    }

    public async end(selector: string) {
        console.debug(`FlowRunner.end | ${selector}`)
        await this.page.waitForSelector(selector)
        if (this.options.idleTime)
            await this.page.waitForNetworkIdle({ idleTime: this.options.idleTime })
        if (this.mode === FlowMode.Timespan)
            await this.userFlow.endTimespan()
        else
            await this.userFlow.endNavigation()
    }
}
