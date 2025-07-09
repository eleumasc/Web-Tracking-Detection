# Login Taint Analysis

A tool for automated taint analysis of login pages.

## System requirements

- Node.js 20 or above
- SQLite 3 or above

## Setup

1. Clone this repository: `git clone https://github.com/eleumasc/Login-Taint-Analysis && cd Login-Taint-Analysis`
2. Install the dependencies: `npm i`
3. Run the init script: `npm run init`
4. Copy `.env.example` to `.env`, then edit `.env` by setting the correct values
5. Build: `npm run build`

## How to use

The tool performs the analysis in stages. Each stage generates a collection in the database (the default location is the "login-taint-analysis.sqlite" file in the project root), which serves as the input for the subsequent stages.

In the following, execute each command by running `npm run start -- <command>`.

**TBD**

## Support

Feel free to open an issue or send a pull request. We will try to sort it as soon as possible.
