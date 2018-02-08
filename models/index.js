const fs = require('fs');
const path = require('path');
const basename = path.basename(module.filename);
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../db/config.json')[env];

/**
 * Mongoose connect
 */
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const connectionStr = 'mongodb://' + config.host + ':27017/' + config.database;
mongoose.connect(connectionStr, { useMongoClient: true });

let db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log(connectionStr);
  console.log('Database connected. Rock and/or roll!');
});

/**
 * 2016-10-16 http://stackoverflow.com/questions/4878756/javascript-how-to-capitalize-first-letter-of-each-word-like-a-2-word-city
 */
function toTitleCase(str) {
  return str.replace(/\w\S*/g, (txt) => { return txt.charAt(0).toUpperCase() + txt.substr(1); });
}

/**
 * Load the models
 */
fs.readdirSync(__dirname)
  .filter((file) => {
    return (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js');
  })
  .forEach((file) => {
    let modelName = toTitleCase(file.slice(0, -3));
    let model = mongoose.model(modelName, require(path.join(__dirname, file))(mongoose));
    db[modelName] = model;
  });

db.mongoose = mongoose;

module.exports = db;
