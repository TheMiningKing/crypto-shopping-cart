require('dotenv').config()

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
 * Parse request body
 */
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

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
 * Flash
 */
const flash = require('connect-flash');
app.use(flash());

/**
 * Routes
 */
app.use('/cart', require('./routes/cart'));
app.use('/category', require('./routes/category'));
app.use('/product', require('./routes/product'));

/**
 * Landing page
 */
app.get('/', (req, res) => {
  if(!req.session.cart) {
    req.session.cart = {
      items: [],
      totals: 0,
      preferredCurrency: process.env.PREFERRED_CURRENCY
    };
  }  

  models.Wallet.find({}).then((wallets) => {
    let preferredWallet;
    wallets.some((wallet) => {
      if (wallet.currency === req.session.cart.preferredCurrency) {
        preferredWallet = wallet;
      }
    });

    // 2018-5-11 https://stackoverflow.com/questions/25586901/how-to-find-document-and-single-subdocument-matching-given-criterias-in-mongodb
    models.Product.find({ 'prices.wallet': preferredWallet ? preferredWallet._id : null },
      { name: 1, description: 1, images: 1, options: 1, categories: 1, friendlyLink: 1, 'prices.$': 1 })
    .populate('prices.wallet').sort('createdAt').then((products) => {

      if (!products.length) {
        req.flash('info', 'Sorry, no products to show.');
      }

      res.render('index', {
        cart: req.session.cart,
        path: req.originalUrl,
        products: products,
        messages: req.flash(),
        wallets: wallets
      });
    }).catch((error) => {
      return res.status(500).send(error);
    });
  }).catch((error) => {
    return res.status(500).send(error);
  });
});

let port = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'tor' ? 3000 : 3001;
app.listen(port, '0.0.0.0', () => {
  console.log('crypto-shopping-cart listening on ' + port + '!');
});

module.exports = app;
