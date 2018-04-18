'use strict';

const express = require('express');
const router = express.Router();
const models = require('../models');
//const Cart = require('../lib/cart');

/**
 * GET /
 */
router.get('/:category', (req, res) => {
  if(!req.session.cart) {
    req.session.cart = {
      items: [],
      totals: 0
    };
  }  

  models.Product.find({ categories: req.params.category }, (err, results) => {
    if (err) {
      req.flash('error', [ { message: 'Something went wrong' } ]);
    }

    models.Product.find({ categories: req.params.category }).sort('createdAt').then((products) => {
      if (!products.length) {
        req.flash('info', `No such category exists: ${req.params.category}`);
      }

      res.render('index', {
        path: req.originalUrl,
        products: products,
        messages: req.flash()
      });
    }).catch((error) => {
      return res.status(500).send(error);
    });

  });
});

module.exports = router;
