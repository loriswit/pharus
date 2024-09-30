import { program } from "commander"
import { runFlow } from "./commands/run.js"
import { drawPlot } from "./commands/plot.js"
import { browseApp } from "./commands/browse.js"
import { cleanCache } from "./commands/clean.js"
import { parseBox2d, parseNumber, parseNumList, parseString } from "./cli.js"
import "./utils/globals.js"

program
    .name(PKG_NAME)
    .description("Pharus is a tool that can run the same user flow on multiple " +
        "versions of the same web app and compare their performances.")
    .version(PKG_VERSION)
    .option("-v, --verbose", "print additional details for debugging purpose")
    .option("--no-sandbox", "disable browser sandbox (dangerous)")

program
    .command("run")
    .description("Run a user flow on multiple versions of a web app and generate a report")
    .summary("run user flow and generate report")
    .argument("<app>", "the web app name")
    .argument("<flow>", "the user flow name")
    .option("-i, --iterations <count>", "number of iterations (default: 10)",
        parseNumber({ type: "int", min: 1 }))
    .option("-p, --patterns <patterns...>", "only include some versions of the app")
    .option("--plot <metric>", "draw a plot of a specific metric")
    .option("--save <name>", "set a custom name for the report",
        parseString({ minLength: 1 }))
    .option("--cpu <mult>", "CPU speed multiplier",
        parseNumber({ type: "float", min: { value: 0, excluded: true } }))
    .option("--net <mult>", "network speed multiplier",
        parseNumber({ type: "float", min: { value: 0, excluded: true } }))
    .option("--timeout <seconds>", "max time spent on a flow step",
        parseNumber({ min: { value: 0, excluded: true } }))
    .option("--headful", "display the browser's GUI")
    .action(actionWrapper(runFlow))

program
    .command("plot")
    .description("Draw a plot of a specific metric from previously generated reports")
    .summary("draw plot for a metric")
    .argument("<report>", "The report name")
    .argument("<metric>", "The metric to plot")
    .option("-p, --patterns <patterns...>", "only include some rendering patterns")
    .option("-s, --steps <numbers...>", "only include some flow steps",
        parseNumList({ type: "int", min: 1 }))
    .option("-t, --truncate <percentile>", "truncated mean percentile (default: 20)",
        parseNumber({ type: "int", min: 0, max: 49 }))
    .option("--title <title>", "the plot title")
    .option("-l, --legends <legends...>", "custom legends for patterns")
    .option("-w, --window-size <width,height>", "the window width and height",
        parseBox2d({ type: "int", min: 200 }))
    .action(actionWrapper(drawPlot))

program
    .command("browse")
    .description("Browse an web app with a specific rendering pattern (for debugging purpose)")
    .summary("freely browse a web app")
    .argument("<app>", "the web app name")
    .argument("<pattern>", "a rendering pattern")
    .action(actionWrapper(browseApp))

program
    .command("clean")
    .description("Clean all docker images and remove the browser")
    .summary("clean the cache")
    .option("-f, --force", "skip confirmation")
    .action(actionWrapper(cleanCache))

program.on("option:verbose", () => VERBOSE = true)
program.on("option:no-sandbox", () => {
    console.warn("Warning: browser sandbox is disabled! Make sure your entirely trust the web app.")
    BROWSER_ARGS = ["--no-sandbox", "--disable-setuid-sandbox"]
})

program.parse()


function actionWrapper(action: (...args: any[]) => void | Promise<void>) {
    return async (...args: any[]) => {
        try {
            await action(...args)
        } catch (error) {
            if (error instanceof Error) {
                console.error("Error: " + error.message)
                console.debug(error.stack)
                process.exit(1)
            } else
                throw error
        }
    }
}
