FROM node:20-slim

RUN apt update
RUN apt install unzip

WORKDIR /app

COPY ./foxhound-fixed.zip ./foxhound.zip
RUN unzip foxhound.zip

COPY ./package.json ./package.json
COPY ./package-lock.json ./package-lock.json

RUN npm i
RUN npm run init

COPY ./tsconfig.json ./tsconfig.json
COPY ./inbrowser ./inbrowser
COPY ./src ./src

RUN npm run build

COPY ./.env ./.env

CMD ["node", "build/worker/__worker.js"]
