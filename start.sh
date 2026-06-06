#!/bin/bash

docker compose run -e WTD_HOST_DIR="$(pwd)" --rm wtd "$@"
