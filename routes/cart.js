'use strict';

const express = require('express');
const router = express.Router();
const models = require('../models');

/**
 * Get /
 */
router.get('/', (req, res) => {
  res.render('cart', {
    pageTitle: 'crypto-shopping-cart',
    cart: null
  });
});

module.exports = router;
