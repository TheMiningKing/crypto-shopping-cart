'use strict';

const express = require('express');
const router = express.Router();
const models = require('../models');
const Cart = require('../lib/cart');
const validator = require('../lib/orderValidator');
const mailer = require('../mailer');
const ejs = require('ejs');
const Styliner = require('styliner');
const path = require('path');
const QRCode = require('qrcode')

/**
 * GET /
 */
router.get('/', (req, res) => {
  let cart = (typeof req.session.cart !== 'undefined') ? req.session.cart : false;
  QRCode.toString(process.env.WALLET, { type: 'svg' }, (err, url) => {
    if (err) {
      console.log(err);
    }

    res.render('cart', {
      pageTitle: 'crypto-shopping-cart',
      path: req.originalUrl,
      cart: cart,
      messages: req.flash(),
      details: {},
      qr: url
    });
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
  let cart = (typeof req.session.cart !== 'undefined') ? req.session.cart : false;

  // Validate order form
  const errors = validator(req.body);
  if (errors) {
    QRCode.toString(process.env.WALLET, { type: 'svg' }, (err, url) => {
      if (err) {
        console.log(err);
      }

      res.render('cart', {
        pageTitle: 'crypto-shopping-cart',
        path: req.originalUrl,
        cart: cart,
        messages: { error: errors },
        qr: url,
        details: req.body
      });
    });
  }
  else {

    Cart.purchase(req.body, cart);

    if (req.body.contact) {
      // Get email text content
      ejs.renderFile(__dirname + "/../views/mailer/orderText.ejs", { cart: req.session.cart }, (err, textEmail) => {
        if (err) {
          console.log(err);
          req.flash('error', [ { message: 'Something went wrong' } ]);
          return res.redirect('/cart');
        }

        // Generate QR code for transaction 
        QRCode.toDataURL(cart.order.transaction, (err, qr) => {
          if (err) {
            console.log(err);
          }

          // Get email HTML content 
          ejs.renderFile(__dirname + "/../views/mailer/orderHtml.ejs", { cart: req.session.cart, qr: qr }, (err, htmlEmail) => {
            if (err) {
              console.log(err);
              req.flash('error', [ { message: 'Something went wrong' } ]);
              return res.redirect('/cart');
            }

            // Inline CSS processing
            const styliner = new Styliner(__dirname + '/..', {noCSS: false});
            styliner.processHTML(htmlEmail).then((htmlAndCss) => {

              // Attach images
              let seen = [];
              let attachments = req.session.cart.items.reduce((atts, item) => {
                if (seen.indexOf(item.image) < 0) {
                  seen.push(item.image);
                  atts.push({ filename: item.image,
                             path: path.resolve(__dirname, '../public/images/products', item.image),
                             cid: item.image });
                }
                return atts;
              }, []);

              // Attach QR
              attachments.push({
                path: qr,
                cid: 'qr.png'
              });

              let mailOptions = {
                to: req.body.email,
                from: process.env.FROM,
                subject: 'Order received - payment and shipping instructions',
                text: textEmail,
                html: htmlAndCss,
                attachments: attachments
              };

              mailer.transporter.sendMail(mailOptions, (err, info) => {
                if (err) {
                  console.log(err);
                  req.flash('error', [ { message: 'Something went wrong' } ]);
                  return res.redirect('/cart');
                }
                req.flash('success', `Your order has been received. An email copy of this receipt will be sent to ${req.body.email}`);
                res.redirect('/cart/receipt');
              });
            }).catch((err) => {
              console.log(err);
              req.flash('error', [ { message: 'Something went wrong' } ]);
              return res.redirect('/cart');
            });
          });
        });
      });
    }
    else {
      req.flash('success', 'Your order has been received. Print this receipt for your records.');
      res.redirect('/cart/receipt');
    }
  }
});

/**
 * GET /receipt
 */
router.get('/receipt', (req, res) => {
  let cart = (typeof req.session.cart !== 'undefined') ? req.session.cart : false;

  if (!cart || !cart.order) {
    res.render('receipt', {
      cart: cart,
      pageTitle: 'crypto-shopping-cart',
      path: req.originalUrl,
      messages: req.flash()
    });
    return;
  }

  QRCode.toString(cart.order.transaction, { type: 'svg' }, (err, url) => {
    if (err) {
      console.log(err);
    }

    cart = Object.assign({}, cart);
    Cart.emptyCart(req.session.cart);

    res.render('receipt', {
      pageTitle: 'crypto-shopping-cart',
      path: req.originalUrl,
      cart: cart,
      messages: req.flash(),
      qr: url
    });
  });
});

module.exports = router;
