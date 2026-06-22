# Web Tracking Detection

A tool for automated comparison of web tracking detection techniques.

## System Requirements

Tested on Ubuntu 24.04.1 LTS

- Docker (works using version 29.5.2, build 79eb04c)

## Setup

1. Clone this repository: `git clone https://github.com/eleumasc/Web-Tracking-Detection && cd Web-Tracking-Detection`
2. Copy `.env.example` to `.env`, then edit `.env` by setting the correct values (the default version should be good to go for most environments)
3. Build: `./build.sh`

## How to Use

Execute each command using `./start.sh <command>`.

1. Create a new analysis (data collection): `analyze <siteListPath>`
   - `<siteListPath>`: Path to Tranco-like site list. The file should reside in the `data` directory.
   - `--noVerif`: Disable the request verification step.
   - `--maxTasks`: Max number of concurrent tasks (NOTE: one running browser per task at the same time).
   - **Effect**: It creates a `*-Analyze` directory in `data` with collected data: taint archives, request archives, screenshots, pre-computed taint and syntactic request lists and canary archives (without `--noVerif`), and the index database `data.sqlite`.
2. Perform data processing from an analysis: `process <analyzeOutDir>`
   - `<analyzeOutDir>`: Path to data directory created by `analyze` command.
   - `--maxTasks`: Max number of concurrent tasks.
   - `--forceNoVerif`: Pretend that the analysis was initiated using `--noVerif` (useful to test the canary generation algorithm).
   - **Effect**: It creates a `*-Process` directory in `data` with the result of data processing: per-site tracking request lists, taint and syntactic request lists and canary archives (if the analysis was initiated using `--noVerif`), and the tracking requests dataset `trackingRequests.json` (`trackingRequests.norelabel.json` for tracking requests before relabeling).
3. Generate the report: `measure <processOutDir>`
   - `<processOutDir>`: Path to data directory created by process command.
   - **Effect**: It creates a `*-Report-<processOutDir>` report file in `data`.

A running analysis, initiated with `analyze` command, can be interrupted and resumed in a second moment.

1. Interrupt the running analysis, e.g., using `CTRL+C` for graceful termination.
2. Resume the interrupted analysis: `process <analyzeOutDir>`
  - `<analyzeOutDir>` Path to data directory of the analysis to resume.
  - `--maxTasks`: Max number of concurrent tasks (NOTE: one running browser per task at the same time).
  - **Note**: The `--noVerif` option cannot be changed at this point.
  - **Effect**: Similar as for `analyze` command, but it resumes data collection in the `<analyzeOutDir>` directory.

Got stuck? Execute a command with the `--help` option to print the command usage.

For developers: execute each command using `./dev.sh <command>` instead of `./start.sh <command>`.

## Support

Feel free to open an issue or send a pull request. We will try to sort it as soon as possible.
