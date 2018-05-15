'use strict';

const express = require('express');
const router = express.Router();
const models = require('../models');

/**
 * GET /
 */
router.get('/:category', (req, res) => {
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
        return true;
      }
      return false;
    });

    models.Product.find({ categories: req.params.category }).populate('prices.wallet').sort('createdAt').then((products) => {
      if (!products.length) {
        req.flash('info', `No such category exists: ${req.params.category}`);
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

module.exports = router;
