FROM node:18-alpine3.15

COPY . /var/app/

WORKDIR /var/app/

ENTRYPOINT ["node", "/var/app/dist/run.js"]

