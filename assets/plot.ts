import { BarController, BarElement, CategoryScale, Chart, Colors, Legend, LinearScale, Title, Tooltip } from "chart.js"
import { BarWithErrorBar, BarWithErrorBarsController } from "chartjs-chart-error-bars"
import type { ParamsPayload } from "../src/plot.js"

Chart.register(
    LinearScale, BarController, BarWithErrorBar, BarWithErrorBarsController,
    CategoryScale, BarElement, Colors, Legend, Title, Tooltip)

const res = await fetch("/params")
const { title, data, unit } = await res.json() as ParamsPayload

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
                            const unitStr =
                                unit === "unitless" ? "" :
                                    (unit === "millisecond" ? "ms" : unit)

                            let values = [context.parsed.y, context.parsed.yMin, context.parsed.yMax] as number[]
                            if (unit === "millisecond")
                                values = values.map(Math.round)

                            const [mean, min, max] = values
                            return `${mean} ${unitStr} [${min}, ${max}]`
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: unit !== "unitless",
                        text: unit,
                    },
                },
            },
        },
    },
)
