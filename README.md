# Web Tracking Detection

A tool for automated comparison of web tracking detection techniques.

## System requirements

- Node.js 20
- SQLite 3
- Docker

## Setup

1. Clone this repository: `git clone https://github.com/eleumasc/Web-Tracking-Detection && cd Web-Tracking-Detection`
2. Install the dependencies: `npm i`
3. Run the init script: `npm run init`
4. Copy `.env.example` to `.env`, then edit `.env` by setting the correct values
5. Build: `npm run build`
6. Build the container image: `npm run build-container-image`

## How to use

The tool performs the analysis in stages. Each stage generates a collection in the database (the default location is the "web-tracking-detection.sqlite" file in the project root), which serves as the input for the subsequent stages.

In the following, execute each command by running `npm run start -- <command>`.

**TBD**

## Support

Feel free to open an issue or send a pull request. We will try to sort it as soon as possible.
