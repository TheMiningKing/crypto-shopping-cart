'use strict';

const express = require('express');
const router = express.Router();
const models = require('../models');

/**
 * GET /
 */
router.get('/:category', (req, res) => {
  models.Wallet.find({}).then((wallets) => {
    let preferredWallet;
    wallets.some((wallet) => {
      if (wallet.currency === req.session.cart.preferredCurrency) {
        preferredWallet = wallet;
      }
    });

    // Only get prices for the preferred wallet
    models.Product
    .find({ 'prices.wallet': preferredWallet ? preferredWallet._id : null, categories: req.params.category },
      { name: 1, description: 1, images: 1, options: 1, categories: 1, friendlyLink: 1, 'prices.$': 1 })
    .populate('prices.wallet').sort('createdAt').then((products) => {
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
