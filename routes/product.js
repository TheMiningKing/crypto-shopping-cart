'use strict';

const express = require('express');
const router = express.Router();
const models = require('../models');

/**
 * GET /
 */
router.get('/:friendlyLink', (req, res) => {
  if(!req.session.cart) {
    req.session.cart = {
      items: [],
      totals: 0
    };
  }  

  models.Product.findOne({ friendlyLink: req.params.friendlyLink }).then((product) => {
    if (!product) {
      req.flash('info', 'That product doesn\'t exist');
    }

    res.render('product', {
      messages: req.flash(),
      path: req.originalUrl,
      product: product,
      referrer: req.get('Referrer') || '/'
    });
  }).catch((error) => {
    return res.status(500).send(error);
  });
});

module.exports = router;
