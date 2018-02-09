'use strict';

const models = require('../models');
const seeder = require('mongoose-seeder'),
      data = require('./data.json');

models.once('open', () => {
  seeder.seed(data, { dropCollections: true }).then((dbData) => {
    console.log('DONE: ' + JSON.stringify(dbData));
    process.exit(0);
  });
});
