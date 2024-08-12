import puppeteer from "puppeteer"
import { checkDockerAvailable } from "../utils/helpers.js"
import { WebApp } from "../web-app.js"

export async function browseApp(appName: string, patternName: string) {
    checkDockerAvailable()

    const app = new WebApp(appName)

    try {
        const port = app.start(patternName)
        const hostname = IN_CONTAINER ? "host.docker.internal" : "localhost"

        const url = `http://${hostname}:${port}`
        console.debug(`Web app is listening to ${url}`)

        console.log("Launching browser")
        const browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            args: BROWSER_ARGS,
        })

        const [page] = await browser.pages()
        await page.goto(url)
        await new Promise(resolve => page.once("close", () => resolve(true)))

    } finally {
        app.stop(patternName)
    }
}
