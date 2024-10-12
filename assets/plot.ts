import { BarController, BarElement, CategoryScale, Chart, Colors, Legend, LinearScale, Title, Tooltip } from "chart.js"
import { BarWithErrorBar, BarWithErrorBarsController } from "chartjs-chart-error-bars"
import type { ParamsPayload } from "../src/plot.js"

Chart.register(
    LinearScale, BarController, BarWithErrorBar, BarWithErrorBarsController,
    CategoryScale, BarElement, Colors, Legend, Title, Tooltip)

const res = await fetch("/params")
const { title, data, unit } = await res.json() as ParamsPayload

// convert to kilobytes
if (unit === "byte") {
    for (const dataset of data.datasets)
        dataset.data.forEach(data => {
            data.y /= 1000
            if (data.yMin) data.yMin /= 1000
            if (data.yMax) data.yMax /= 1000
        })
}

if (title)
    document.title = title

const canvas = document.getElementById("chart") as HTMLCanvasElement

new Chart(
    canvas,
    {
        data,
        type: "barWithErrorBars",
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    text: title,
                    display: true,
                },
                tooltip: {
                    callbacks: {
                        label(context) {
                            let unitLabel: string
                            let values = [context.parsed.y, context.parsed.yMin, context.parsed.yMax] as number[]

                            switch (unit) {
                                case "millisecond":
                                    unitLabel = "ms"
                                    values = values.map(Math.round)
                                    break

                                case "byte":
                                    unitLabel = "KB"
                                    values = values.map(Math.round)
                                    break

                                case "unitless":
                                case undefined:
                                    unitLabel = ""
                                    break

                                default:
                                    unitLabel = unit
                            }

                            const [mean, min, max] = values
                            return `${mean} ${unitLabel} [${min}, ${max}]`
                        },
                    },
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: unit !== "unitless",
                        text: unit === "byte" ? "kilobyte" : unit,
                    },
                },
            },
        },
    },
)
