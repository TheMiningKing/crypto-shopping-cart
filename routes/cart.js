'use strict';

const express = require('express');
const router = express.Router();
const models = require('../models');
const Cart = require('../lib/cart');

/**
 * GET /
 */
router.get('/', (req, res) => {
  res.render('cart', {
    pageTitle: 'crypto-shopping-cart',
    cart: null
  });
});

/**
 * POST /
 */
router.post('/', (req, res) => {
  models.Product.findOne({_id: req.body.id}).then(prod => {
    Cart.addToCart(prod, req.session.cart);
    res.redirect('/cart');
  }).catch(err => {
    res.redirect('/');
  });
});

module.exports = router;
