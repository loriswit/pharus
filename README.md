# Pharus

Pharus is command-line tool that can compare performances of web apps implemented with different rendering patterns.

- [Installation](#installation)
    * [Requirements](#requirements)
    * [Setup with Node.js](#setup-with-nodejs)
    * [Setup with Docker only](#setup-with-docker-only)
- [Web apps & user flows](#web-apps--user-flows)
    * [Web app definition](#web-app-definition)
    * [Rendering patterns](#rendering-patterns)
    * [User flows](#user-flows)
- [Pharus commands](#pharus-commands)
    * [Running a benchmark](#running-a-benchmark)
    * [Drawing plots](#drawing-plots)
    * [Utility commands](#utility-commands)
- [Troubleshooting](#troubleshooting)
    * [Debugging web apps & user flows](#debugging-web-apps--user-flows)
    * [Missing Chromium dependencies](#missing-chromium-dependencies)
    * [No usable sandbox](#no-usable-sandbox)
    * [Reinstalling / updating](#reinstalling--updating)
- [Limitations](#limitations)
- [Contributing](#contributing)

## Installation

### Requirements

The following is required to run Pharus:

- Docker
- Node.js version 20.11 or later (optional)

If Node.js cannot be installed, Pharus can be launched inside its [own Docker container](#setup-with-docker-only). However, some feature may not be fully functional.

### Setup with Node.js

Clone or download this repository and run `bin/pharus` (on Windows: `bin\pharus`). This will automatically install dependencies and build the source code.

A web browser will also be installed in the *~/.cache* directory. When installed, Pharus may display a list of missing libraries, if any. See [missing Chromium dependencies](#missing-chromium-dependencies).

### Setup with Docker only

If you can't install Node.js on your system, you can start Pharus as a Docker container. To achieve this, clone or download the repository and run `bin/pharus-docker`. This will automatically build a Docker image containing both Pharus and Chromium.

Note that when running in a Docker container, Pharus will communicate with the host Docker Engine to manage the web apps, which may sometimes result in conflicts when trying to resolve paths that are different on the host system and in the container. For this reason, the [setup with Node.js](#setup-with-nodejs) is preferred.

## Web apps & user flows

To use Pharus, you need to provide at least one web app implemented with different rendering patterns. You also need to provide at least one user flow for each web app.

Web apps should be placed inside the *app* folder at the root of this repository.

### Web app definition

A web app consists of a folder which name is the name of the web app. This folder **must** contain both a *patterns* and a *flows* subfolder.

The *patterns* folder must contain at least one subfolder which name is the name of a rendering pattern. Each of these subfolders must contain the source code for the application implemented with this rendering pattern, including a [*compose.yaml* file](https://docs.docker.com/compose/) that describes how to start the app.

The *flows* folder must contain at least one user flow. These user flows must be written using a [custom language](#user-flows) described below. They must be stored in files with the `.flow` extension.

Additional folders can exist within the web app directory. They should be used to store shared assets, configuration files and Dockerfiles.

The overall folder structure should like this:

```
📁 <app-name>/
├─ 📁 patterns/
│  ├─ 📁 <pattern-A>/
│  │  ├─ [source files...]
│  │  └─ compose.yaml
│  ├─ 📁 <pattern-B>/
│  └─ 📁 <pattern-C>/
├─ 📁 flows/
│  ├─ <flow-A>.flow
│  ├─ <flow-B>.flow
│  └─ <flow-C>.flow
└─ 📁 [helper folders...]/
```

### Rendering patterns

The web app must be implemented with each rendering pattern such that it looks and behaves the exact same way every time. This means that a user performing a sequence of actions will always trigger the same results no matter the rendering pattern.

The [*compose.yaml* file](https://docs.docker.com/compose/) must define every services needed for the web app to run, for example: the web app itself, a database, a web server, etc. It is **recommended to define each service in its own Dockerfile**, rather than referencing images from Docker Hub. Otherwise, the [*clean* command](#clean-all-pharus-components) will not be able to remove them.

While developing a specific rendering pattern, you can use the [*browse* command](#browse-a-web-app) to check whether the web app starts and works correctly in the Pharus environment.

### User flows

A user flow represents a sequence of actions performed by a virtual user of the web app. In order to simplify the process of defining new user flows, a custom high-level language was created for this purpose.

The language is quite simple and is defined as follows.

- Each line represents a single statement.
- Each statement must start with a **command** followed by arguments (similar to CLI languages)
- Arguments must be separated by whitespaces.
- Arguments that contain whitespaces must be enclosed in double quotes `"`.
- Comments start with `%` and end with a newline. They are ignored by the parser.

The following commands are currently available:

| Command                                                            | Description                                                 | Arguments                                                                                                                     |
|--------------------------------------------------------------------|-------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| `begin <title>`                                                    | Start a new [benchmark block](#benchmark-blocks)            | **title**: The title of the block                                                                                             |
| `end when <selector>`                                              | End the benchmark block when an element appears on the page | **selector**: A [CSS selector](#css-selectors) for the target element                                                         |
| `click <selector>`                                                 | Click on a specific element                                 | **selector**: A [CSS selector](#css-selectors) for the target element                                                         |
| `type <text> into <selector>` <br> `type <text> in <selector>`     | Write some text into an input field                         | **text**: The text to type into the field <br> **selector**: A [CSS selector](#css-selectors) for the target field            |
| `select <value> in <selector>` <br> `select <value> of <selector>` | Select an option from a dropdown menu                       | **value**: the `value` attribute of the target option <br> **selector**: A [CSS selector](#css-selectors) for the target menu |
| `scroll to <selector>`                                             | Scrolls the page until a specific element becomes visible   | **selector**: A [CSS selector](#css-selectors) for the target element                                                         |

#### Benchmark blocks

A benchmark block delimits a sequence of actions during which performances will be analysed. Each block must have a title that describes what the user performs. Each block is being evaluated separately (the performance of one block has no impact on the following one). Actions executed outside of benchmark blocks won't be part of the benchmark.

#### CSS selectors

When targeting an element on the page, a standard CSS selector can be provided. Pharus also allows for an extended syntax for CSS selectors as [defined by Puppeteer](https://pptr.dev/guides/page-interactions#non-css-selectors). This make it possible to select elements containing specific text with the `-p-text` selector, among other things.

#### Example

```
% this is a comment
begin "Publish comment"
click footer>button[type=submit]
end when .comment>.author::-p-text(Alice)
```

## Pharus commands

To execute a command, run `bin/pharus <command> [args...]` (or `bin/pharus-docker <command> [args...]` when using without Node.js).

When an argument refers to a web app or a report, you can either provide its name or a **full path**. When only the name is provided, Pharus will look into the *app* or *report* directory for the corresponding file.

### Running a benchmark

```
bin/pharus run [options] <web-app> <user-flow>
```

This command will sequentially start each rendering pattern of the given web app and execute the same user flow every time. For each rendering pattern, new Docker containers will be instantiated and executed. If the corresponding Docker images don't exist yet, they will be created. At the end, containers and associated volumes are automatically removed. This whole process is repeated multiple times, according to the value of the `--iterations` option (10 times by default).

When the benchmark has finished running, a report will be saved in the *report* folder at the root of this repository. This report can then be used to draw plots with the [plot command](#drawing-plots).

The `run` command can be configured with various options: number of iterations, CPU and network speed, etc. To obtain the list of all available options, run `bin/pharus help run`.

It is recommended to run the benchmark on a device that's not running other resource-consuming processes, so that results are more consistent.

#### Example

```
bin/pharus run blog visitor-flow --iterations 20 --cpu 0.1 --save slow-device-report
```

### Drawing plots

```
bin/pharus plot [options] <report> <metric>
```

This command will draw a plot that displays the given metric of the provided report for each rendering pattern **and** for each benchmark block. The `report` argument must be the folder name of the report located in the *report* directory, or a full path to a report elsewhere.

The `metric` argument can be any property of the `steps[n].lhr.audit` object that can be found in the JSON files of the report. This argument is case-insensitive. Below are some common metrics:

| Metric                      | Alias                        |
|-----------------------------|------------------------------|
| `largest-contentful-paint`  | `LCP`                        |
| `first-contentful-paint`    | `FCP`                        |
| `interaction-to-next-paint` | `INP`                        |
| `total-blocking-time`       | `TBT`                        |
| `cumulative-layout-shift`   | `CLS`                        |
| `network-rtt`               | `RTT`                        |
| `interactive`               | `TTI`, `time-to-interactive` |
| `server-response-time`      | `TTFB`, `time-to-first-byte` |

You can also specify a "nested" metrics according to the structure of the JSON file. For example, the following metric represents the number of requests: `network-requests.details.items.length`.

This command instantiates a graphical user interface to show the plot, which may not work when Pharus is executed in a Docker container, or running on a headless device. If that is the case, reports can simply be copied to another device that supports graphical interfaces.

By default, the plot shows the 20% truncated mean of the report values. This can be adjusted with the `--truncate` option.

You can customize the plot with the help of the `--tile` and `--legends` options. To list all available options, run `bin/pharus help plot`.

#### Example

```
bin/pharus plot slow-device-report TBT --truncate 10 --patterns ssr csr islands
```

### Utility commands

#### Browse a web app

```
bin/pharus browse <web-app> <pattern>
```

This commands starts a web app with a specific render pattern in a new browser window, without executing any workflow. This can be helpful when implementing a new web app to check whether it works correctly.

#### Clean all Pharus components

```
bin/pharus clean
```

This commands removes the installed browser and every Docker container, image and volumes related to Pharus. This can be helpful when Pharus is not needed anymore and one needs to clean all the components that are not located inside the Pharus directory.

#### Help command

```
bin/pharus help <command>
bin/pharus <command> --help
```

These can be used to learn more about a specific command.

## Troubleshooting

### Debugging web apps & user flows

When a user flow doesn't get executed as expected, it can get tricky to figure out what's not working. Below are some tips that can help debugging.

#### Verbose output

Pharus can print additional information when running in verbose mode. This makes debugging easier in general.

```
bin/pharus --verbose <command>
```

#### "Headful" browser

You can start the browser in "headful" mode when running benchmarks in order to see what's happening while executing the user flow.

```
bin/pharus run --headful <web-app> <user-flow>
```

#### Longer timeouts

Pharus will fail if a target element cannot be found and doesn't appear on the page for 20 seconds. You can increase this timeout if you except some actions to last a long time.

```
bin/pharus run --timeout 60 <web-app> <user-flow>
```

#### Reports metadata

A `meta.json` file is generated with each report. This file contains various information about the benchmark, such as the values of the parameters, the duration, errors, etc.

### Missing Chromium dependencies

When trying to run Pharus on a headless machine, it's likely that some libraries required by Chromium won't be installed by default. Pharus will list them the first time you launch it, but it will not install them automatically.

To get the list of all the missing dependencies, you can either [reinstall Pharus](#reinstalling--updating), or run the following command:

```sh
ldd $(node -e "console.log(require('puppeteer').executablePath())") | grep "not found"
```

If you cannot install all the required libraries, you can alternatively run Pharus in a [Docker container](#setup-with-docker-only), which will take care of setting up the browser correctly.

### No usable sandbox

By default, the browser will run each web app in an isolated sandbox. If it cannot find a usable on the current system, you will get the "no usable sandbox" error.

If you cannot install a compatible sandbox on the system that runs Pharus, you can provide the `--no-sandbox` option when launching Pharus to disable the sandbox requirement. Note that you should only do this if you entirely trust the web app!

### Reinstalling / updating

To reinstall or update Pharus to a newer version, run the following commands:

```sh
# update the source code
git pull

# reinstall Pharus
rm -rf build
bin/pharus
```

## Limitations

Pharus currently has a few limitations, some of which may be fixed at a later time:

- Pharus cannot run on ARM platforms because the browser fails to start correctly (here's a possible [workaround](https://github.com/yzane/vscode-markdown-pdf/issues/125)).
- When running Pharus in a [Docker container](#setup-with-docker-only), the [`--no-sandbox` option](#no-usable-sandbox) is enabled by default.
- When the Pharus process is killed (e.g., with Ctrl+C), the containers currently running the web app may not stop. If that happens, you can either stop the containers manually or use the [*clean* command](#clean-all-pharus-components).

## Contributing

To contribute to this repository, you can set up the development environment as follows.

Install dependencies:

```
npm install
```

Execute a Pharus command (without building):

```
npm run dev -- <command> [args...]
```
