# Web Tracking Detection (for DEVELOPERS)

A tool for automated comparison of web tracking detection techniques.

## System Requirements

Tested on Ubuntu 24.04.1 LTS

- Docker (works using version 29.5.2, build 79eb04c)
- Node.js (works using version 22.19.0)
- SQLite (works using version 3.45.1)

## Setup

1. Clone this repository: `git clone https://github.com/eleumasc/Web-Tracking-Detection && cd Web-Tracking-Detection`
2. Run the bootstrap script: `npm run bootstrap`
3. Copy `.env.example` to `.env`, then edit `.env` by setting the correct values (the default version should be good to go for most environments)
4. Build: `./build.sh` (for the worker)

## How to Use

Follow the "How to Use" instructions from `README.md`, but execute each command using `./dev.sh <command>` instead of `./start.sh -- <command>`.

## Support

Feel free to open an issue or send a pull request. We will try to sort it as soon as possible.
