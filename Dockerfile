FROM node:22.19.0-slim

RUN apt update && apt install -y sqlite3 curl p7zip-full build-essential python3 python3-dev make g++

WORKDIR /root

COPY ./foxhound-fixed.zip ./foxhound.zip
RUN 7z x foxhound.zip

COPY ./package.json ./package.json
COPY ./package-lock.json ./package-lock.json

RUN npm run bootstrap

COPY ./.env ./.env

COPY ./tsconfig.json ./tsconfig.json
COPY ./setup ./setup
COPY ./src ./src

RUN npx tsc

ENTRYPOINT ["node", "build/index.js"]
