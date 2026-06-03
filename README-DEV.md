# Web Tracking Detection (for DEVELOPERS)

A tool for automated comparison of web tracking detection techniques.

## System Requirements

Tested on Ubuntu 24.04.1 LTS

- Docker (works using version 29.5.2, build 79eb04c)
- Node.js (works using version 22.17.0)
- SQLite (works using version 3.45.1)

## Setup

1. Clone this repository: `git clone https://github.com/eleumasc/Web-Tracking-Detection && cd Web-Tracking-Detection`
2. Install the dependencies: `npm i`
3. Run the init script: `npm run init`
4. Copy `.env.example` to `.env`, then edit `.env` by setting the correct values (the default version should be good to go for most environments)
5. Build: `npm run build` (for the worker)

## How to Use

Follow the "How to Use" instructions from `README.md`, but execute each command using `npm run dev -- <command>` instead of `npm run start -- <command>`.

## Support

Feel free to open an issue or send a pull request. We will try to sort it as soon as possible.
