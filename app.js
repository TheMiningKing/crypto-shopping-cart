require('dotenv').config()

const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const models = require('./models');
const path = require('path');
const Cart = require('./lib/cart');

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
 * For PUT/PATCH/DELETE
 */
//const methodOverride = require('method-override');
//app.use(methodOverride('_method'));

/**
 * Sessions
 */
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);

const sessionConfig = {
  name: process.env.SITE_NAME,
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false,
  unset: 'destroy',
  cookie: {
    maxAge: 1000 * 60 * 60,
  },
  store: new MongoStore({ mongooseConnection: models }),
};

app.use(session(sessionConfig));

/**
 * Passport authentication
 */
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy({
    usernameField: 'email'
  },
  function(email, password, done) {
    models.Agent.findOne({ email: email }).then(agent => {
      if (!agent) {
        return done(null, false);
      }
      models.Agent.validPassword(password, agent.password, (err, res) => {
        if (err) {
          console.log(err);
        }
        return done(err, res);
      }, agent);
    }).catch(err => {
      return done(err);
    });

  }));

passport.serializeUser((agent, done) => {
  done(null, agent._id);
});

passport.deserializeUser((id, done) => {
  models.Agent.findById(id).then(agent => {
    return done(null, agent);
  }).catch(error => {
    return done(error);
  });
});

/**
 * Flash
 */
const flash = require('connect-flash');
app.use(flash());

/**
 * Session shopping cart
 */
app.use((req, res, next) => {
  if (!req.session.cart) {
    req.session.cart = Cart.getEmptyCart();
  }
  next();
});

/**
 * Routes
 */
app.use('/', require('./routes/auth'));
app.use('/cart', require('./routes/cart'));
app.use('/category', require('./routes/category'));
app.use('/product', require('./routes/product'));

/**
 * Landing page
 */
app.get('/', (req, res) => {
  models.Wallet.find({}).sort('createdAt').then((wallets) => {
    let preferredWallet;
    wallets.forEach((wallet) => {
      if (wallet.currency === req.session.cart.preferredCurrency) {
        preferredWallet = wallet;
      }
    });

    // 2018-5-11 https://stackoverflow.com/questions/25586901/how-to-find-document-and-single-subdocument-matching-given-criterias-in-mongodb
    models.Product.find({ 'prices.wallet': preferredWallet ? preferredWallet._id : null },
      { name: 1, description: 1, images: 1, options: 1, categories: 1, friendlyLink: 1, 'prices.$': 1, quantity: 1 })
    .sort('createdAt').then((products) => {

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

/**
 * Shipping and return policy
 */
app.get('/policy', (req, res) => {
  res.render('policy', {
    path: req.originalUrl,
    messages: req.flash(),
    referrer: req.get('Referrer') || '/'
  });
});

let port = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'tor' ? 3000 : 3001;
app.listen(port, '0.0.0.0', () => {
  console.log('crypto-shopping-cart listening on ' + port + '!');
});

module.exports = app;
