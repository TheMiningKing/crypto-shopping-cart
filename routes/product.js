'use strict';

const express = require('express');
const router = express.Router();
const models = require('../models');

/**
 * GET /
 */
router.get('/:friendlyLink', (req, res) => {

  models.Wallet.find().then((wallets) => {
    let preferredWallet;
    wallets.some((wallet) => {
      if (wallet.currency === req.session.cart.preferredCurrency) {
        preferredWallet = wallet;
      }
    });

    models.Product.findOne(
      { friendlyLink: req.params.friendlyLink, 'prices.wallet': preferredWallet ? preferredWallet._id : null },
      { name: 1, description: 1, images: 1, options: 1, categories: 1, friendlyLink: 1, 'prices.$': 1 })
    .populate('prices.wallet').then((product) => {
  
      if (!product) {
        req.flash('info', 'That product doesn\'t exist');
      }
  
      res.render('product', {
        cart: req.session.cart,
        messages: req.flash(),
        path: req.originalUrl,
        product: product,
        referrer: req.get('Referrer') || '/',
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
