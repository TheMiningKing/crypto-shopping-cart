FROM node
ENV NPM_CONFIG_LOGLEVEL warn
EXPOSE 3000

USER node
ENV HOME=/home/node

WORKDIR $HOME

ENV PATH $HOME/app/node_modules/.bin:$PATH

ADD package.json $HOME
RUN NODE_ENV=production npm install

CMD ["node", "./app.js"]
