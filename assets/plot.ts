import { BarController, BarElement, CategoryScale, Chart, Colors, Legend, LinearScale, Title } from "chart.js"
import { BarWithErrorBar, BarWithErrorBarsController } from "chartjs-chart-error-bars"
import type { ParamsPayload } from "../src/plot.ts"

Chart.register(
    LinearScale, BarController, BarWithErrorBar, BarWithErrorBarsController,
    CategoryScale, BarElement, Colors, Legend, Title)

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
