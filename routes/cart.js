'use strict';

const express = require('express');
const router = express.Router();
const models = require('../models');
const Cart = require('../lib/cart');
const mailer = require('../mailer');
const ejs = require('ejs');

/**
 * GET /
 */
router.get('/', (req, res) => {
  let cart = (typeof req.session.cart !== 'undefined') ? req.session.cart : false;
  res.render('cart', {
    pageTitle: 'crypto-shopping-cart',
    path: req.originalUrl,
    cart: cart,
    messages: req.flash()
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

  // Send email to buyer
  ejs.renderFile(__dirname + "/../views/mailer/orderText.ejs", { cart: req.session.cart }, (err, textEmail) => {
    if (err) {
      console.log(err);
      req.flash('error', err);
      return res.redirect('/cart');
    }

    let mailOptions = {
      to: req.body.email,
      from: process.env.FROM,
      subject: 'Order received - payment and shipping instructions',
      text: textEmail
    };
    mailer.transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        req.flash('error', err);
        return res.redirect('/cart');
      }
      Cart.emptyCart(req.session.cart);
      req.flash('success', `An email has been sent to ${req.body.email} with transaction and shipping instructions`);
      res.redirect('/');
    });
  });
});

module.exports = router;
