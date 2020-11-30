'use strict';

const express = require('express');
const router = express.Router();
const models = require('../models');

/**
 * GET /
 */
router.get('/', (req, res) => {
  models.Wallet.find().sort('createdAt').then((wallets) => {
    models.Product.find({}).sort('createdAt').then((products) => {
      if (!products.length) {
        req.flash('info', 'Sorry, no products to show.');
      }
  
      res.render('product/index', {
        cart: req.session.cart,
        path: req.originalUrl,
        products: products,
        messages: req.flash(),
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

/**
 * GET /:friendlyLink
 */
router.get('/:friendlyLink', (req, res) => {

  models.Wallet.find().sort('createdAt').then((wallets) => {
    let preferredWallet;
    wallets.some((wallet) => {
      if (wallet.currency === req.session.cart.preferredCurrency) {
        preferredWallet = wallet;
      }
    });

    models.Product.findOne(
      { friendlyLink: req.params.friendlyLink, 'prices.wallet': preferredWallet ? preferredWallet._id : null },
      { name: 1, description: 1, images: 1, options: 1, categories: 1, friendlyLink: 1, 'prices.$': 1, quantity: 1, createdAt: 1 })
    .then((product) => {
  
      if (!product) {
        req.flash('info', 'That product doesn\'t exist');
        return res.render('product/show', {
          cart: req.session.cart,
          messages: req.flash(),
          path: req.originalUrl,
          product: product,
          referrer: req.get('Referrer') || '/'
        });
      }
  
      models.Product.find({createdAt: {$gt: product.createdAt}}).sort({createdAt: 1}).limit(1).then((nextProduct) => {
        res.render('product/show', {
          cart: req.session.cart,
          messages: req.flash(),
          path: req.originalUrl,
          product: product,
          nextProduct: nextProduct,
          referrer: req.get('Referrer') || '/',
          wallets: wallets
        });
      }).catch((error) => {
        return res.status(500).send(error);
      });
    }).catch((error) => {
      return res.status(500).send(error);
    });
  }).catch((error) => {
    return res.status(500).send(error);
  });
});

module.exports = router;
