const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const models = require('./models');
const path = require('path');

/**
 * Set static directory
 */
app.use(express.static('public'));

/**
 * view engine setup
 */
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

/**
 * Parse JSON
 */
app.use(bodyParser.json());

/**
 * Sessions
 */
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/db/config.json')[env];

const store = new MongoDBStore({
  uri: `mongodb://${config.host}:27017/${config.database}`,
  collection: 'sessions'
});

store.on('error', (error) => {
  console.error('Could not set up sessions');
  console.error(error);
});

app.use(session({
  secret: 's3cr3tk3y',
  resave: false,
  saveUninitialized: true,
  store: store,
}));

/**
 * Routes
 */
app.use('/cart', require('./routes/cart'));

/**
 * Landing page
 */
app.get('/', (req, res) => {
  models.Product.find({}, (err, products) => {
    if (err) {
      return res.status(500).send(err);
    }

    res.render('index', {
      pageTitle: 'crypto-shopping-cart',
      products: products
    });
  });
});


let port = process.env.NODE_ENV === 'production' ? 3000 : 3001;
app.listen(port, '0.0.0.0', () => {
  console.log('crypto-shopping-cart listening on ' + port + '!');
});

module.exports = app;
