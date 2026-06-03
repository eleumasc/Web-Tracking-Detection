FROM node:22-slim

RUN apt update
RUN apt install -y sqlite3 unzip

WORKDIR /root

COPY ./foxhound-fixed.zip ./foxhound.zip
RUN unzip foxhound.zip

COPY ./package.json ./package.json
COPY ./package-lock.json ./package-lock.json

RUN npm run bootstrap

COPY ./tsconfig.json ./tsconfig.json
COPY ./setup ./setup
COPY ./src ./src

RUN npx tsc

COPY ./.env ./.env

ENTRYPOINT ["node", "build/index.js"]
