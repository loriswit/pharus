import { createReadStream, existsSync, lstatSync } from "node:fs"
import { resolve } from "node:path"
import { type Server } from "node:http"
import { type ListenOptions } from "node:net"
import Koa from "koa"
import { type Dataset } from "./report.js"
import { launchBrowser } from "./utils/helpers.js"
import { execSync } from "node:child_process"

export interface PlotOptions {
    title: string
    unit: string
}

export interface BrowserOptions {
    windowSize: {
        width: number
        height: number
    }
    onClose: Function
}

export interface ParamsPayload {
    title: string
    unit: string | undefined
    data: {
        labels: string[]
        datasets: Dataset[]
    }
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
        // build assets if Vite is installed (dev only)
        const vitePath = resolve(PKG_ROOT, "node_modules", ".bin", "vite")
        if (existsSync(vitePath)) {
            const stdout = execSync(`${vitePath} build`)
            console.debug(stdout)
        }

        const app = new Koa().use(async ctx => {
            if (ctx.request.url === "/params") {
                ctx.type = "application/json"
                ctx.body = {
                    title: this.options.title,
                    unit: this.options.unit,
                    data: {
                        labels: this.labels,
                        datasets: this.datasets,
                    },
                } as ParamsPayload

            } else {
                // act as a simple web server
                const filename = ctx.request.url.substring(1) // remove initial slash
                const assetsRoot = resolve(PKG_ROOT, "build", "assets")
                const targetFile = resolve(assetsRoot, filename)

                // prevent access to files outside root folder
                if (targetFile.indexOf(assetsRoot) !== 0) {
                    ctx.status = 403
                    ctx.body = "Forbidden"
                    return
                }

                if (existsSync(targetFile) && lstatSync(targetFile).isFile()) {
                    ctx.body = createReadStream(targetFile)
                    // determine MIME type
                    const ext = targetFile.split(".").at(-1)
                    const mimeTypes: Record<string, string> = {
                        "html": "text/html",
                        "css": "text/css",
                        "js": "text/javascript",
                    }
                    if (ext && ext in mimeTypes)
                        ctx.type = mimeTypes[ext]
                } else {
                    ctx.status = 404
                    ctx.body = "Not found"
                }
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
    public async displayInBrowser(
        {
            onClose = () => {},
            windowSize = { width: 900, height: 500 },
        }: Partial<BrowserOptions> = {},
    ) {
        // if no server is running yet, start server and stop on page close
        if (!this.server) {
            this.server = this.startServer()
            const onCloseCallback = onClose
            onClose = () => {
                this.stopServer()
                onCloseCallback()
            }
        }

        const address = this.server.address()
        if (address === null || typeof address !== "object")
            throw new Error("Failed to start web server")

        const url = `http://localhost:${address.port}/plot.html`
        console.debug(`Plot is accessible through ${url}`)

        const browser = await launchBrowser({
            headless: false,
            args: [
                `--window-size=${windowSize.width},${windowSize.height}`,
                `--app=${url}`,
                ...BROWSER_ARGS,
            ],
            defaultViewport: null,
        })

        const [page] = await browser.pages()
        page.once("close", () => onClose())
    }
}
