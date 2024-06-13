import puppeteer from "puppeteer"
import { checkDockerAvailable } from "../utils/helpers.js"
import { WebApp } from "../web-app.js"

export async function browseApp(appName: string, patternName: string) {
    checkDockerAvailable()

    const app = new WebApp(appName)

    try {
        const port = app.start(patternName)

        console.log("Launching browser")
        const browser = await puppeteer.launch({ headless: false, defaultViewport: null })

        const [page] = await browser.pages()
        await page.goto(`http://localhost:${port}`)
        await new Promise(resolve => page.once("close", () => resolve(true)))

    } finally {
        app.stop(patternName)
    }
}
