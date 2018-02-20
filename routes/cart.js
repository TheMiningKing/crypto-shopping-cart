'use strict';

const express = require('express');
const router = express.Router();
const models = require('../models');
const Cart = require('../lib/cart');
const mailer = require('../mailer');

/**
 * GET /
 */
router.get('/', (req, res) => {
  let cart = (typeof req.session.cart !== 'undefined') ? req.session.cart : false;
  res.render('cart', {
    pageTitle: 'crypto-shopping-cart',
    path: req.originalUrl,
    cart: cart
  });
});

/**
 * POST /
 */
router.post('/', (req, res) => {
  models.Product.findOne({_id: req.body.id}).then(prod => {
    Cart.addToCart(prod, req.body.option, req.session.cart);
    res.redirect('/cart');
  }).catch(err => {
    res.redirect('/');
  });
});

/**
 * GET /remove/:id/:option?
 */
router.get('/remove/:id/:option?', (req, res) => {
  Cart.removeFromCart(req.params.id, req.params.option || null, req.session.cart);
  res.redirect('/cart');
});

/**
 * POST /checkout
 */
router.post('/checkout', (req, res) => {
  req.flash('success', 'An email has been sent to dan@example.com with transaction and shipping instructions');
  res.redirect('/');
});


module.exports = router;
