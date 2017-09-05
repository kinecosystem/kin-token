FROM node:8

RUN mkdir /code
WORKDIR /code
COPY package-lock.json .
COPY package.json .

RUN apt-get -qq update \
    && apt-get -qq install netcat \
    && apt-get clean && rm -rf /var/lib/apt/lists /tmp/* /var/tmp/* \
    && npm install -q

ENV PATH="/code/node_modules/.bin:${PATH}"
VOLUME ["/code"]
EXPOSE 8545
CMD ["truffle"]
