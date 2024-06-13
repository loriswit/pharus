import { createReadStream } from "node:fs"
import { resolve } from "node:path"
import { type Server } from "node:http"
import { type ListenOptions } from "node:net"
import Koa from "koa"
import puppeteer from "puppeteer"
import { type Dataset } from "./report.js"

export interface PlotOptions {
    title: string
}

export interface BrowserOptions {
    onClose: Function
}

export class Plot {
    private readonly labels: string[]
    private readonly datasets: Dataset[]
    private readonly options: Partial<PlotOptions>
    private server: Server | null = null

    public constructor(labels: string[], datasets: Dataset[], options: Partial<PlotOptions> = {}) {
        this.labels = labels
        this.datasets = datasets
        this.options = options
    }

    /**
     * Starts a web server which displays the plot.
     */
    public startServer(serverOptions: ListenOptions | undefined = undefined): Server {
        const app = new Koa().use(async ctx => {
            if (ctx.request.url === "/params") {
                ctx.type = "application/json"
                ctx.body = {
                    title: this.options.title,
                    data: {
                        labels: this.labels,
                        datasets: this.datasets,
                    },
                }

            } else if (ctx.request.url === "/") {
                ctx.type = "html"
                ctx.body = createReadStream(resolve(import.meta.dirname, "assets", "plot.html"))
            }
        })

        this.server = app.listen(serverOptions)
        return this.server
    }

    public stopServer() {
        this.server?.close()
    }

    /**
     * Opens a browser in "app" mode to display the plot.
     */
    public async displayInBrowser(options: Partial<BrowserOptions> = {}) {
        // if no server is running yet, start server and stop on page close
        if (!this.server) {
            this.server = this.startServer()
            const onCloseCallback = options.onClose
            options.onClose = () => {
                this.stopServer()
                onCloseCallback?.()
            }
        }

        const address = this.server.address()
        if (address === null || typeof address !== "object")
            throw new Error("Failed to start web server")

        const browser = await puppeteer.launch({
            headless: false,
            args: [
                "--window-size=900,500",
                `--app=http://localhost:${address.port}`],
            defaultViewport: null,
        })

        const [page] = await browser.pages()
        page.once("close", () => options.onClose?.())
    }
}
