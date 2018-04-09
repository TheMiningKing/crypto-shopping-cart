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

/**
 * GET /
 */
router.get('/', (req, res) => {
  let cart = (typeof req.session.cart !== 'undefined') ? req.session.cart : false;
  res.render('cart', {
    path: req.originalUrl,
    cart: cart,
    messages: req.flash(),
    referrer: req.get('Referrer'),
    details: {}
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
    res.render('cart', {
      path: req.originalUrl,
      cart: cart,
      messages: { error: errors },
      referrer: req.get('Referrer'),
      details: req.body
    });
  }
  else {

    Cart.purchase(req.body, cart);

    // Determine appropriate mailer templates
    const orderPaid = req.body.transaction && req.body.transaction.trim();
    const vendorTextTemplate = 'vendorUnpaidText.ejs';
    const vendorHtmlTemplate = 'vendorUnpaidHtml.ejs';
    const buyerTextTemplate = 'orderUnpaidText.ejs';
    const buyerHtmlTemplate = 'orderUnpaidHtml.ejs';

    // Get vendor text content 
    ejs.renderFile(`${__dirname}/../views/mailer/${vendorTextTemplate}`, { cart: req.session.cart }, (err, textVendor) => {
      if (err) {
        console.log(err);
        req.flash('error', [ { message: 'Something went wrong' } ]);
        return res.redirect('/cart');
      }

      // Get vendor HTML content 
      ejs.renderFile(`${__dirname}/../views/mailer/${vendorHtmlTemplate}`, { cart: req.session.cart }, (err, htmlVendor) => {
        if (err) {
          console.log(err);
          req.flash('error', [ { message: 'Something went wrong' } ]);
          return res.redirect('/cart');
        }

        // Inline CSS processing for vendor email
        const styliner = new Styliner(__dirname + '/..', {noCSS: false});
        styliner.processHTML(htmlVendor).then((vendorHtmlAndCss) => {

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

          let vendorMailOptions = {
            to: process.env.FROM,
            from: req.body.email || process.env.FROM,
            subject: orderPaid ? 'New order received' : 'New order received - unpaid',
            text: textVendor,
            html: vendorHtmlAndCss,
            attachments: attachments
          };

          // Send order to vendor
          mailer.transporter.sendMail(vendorMailOptions, (err, info) => {
            if (err) {
              console.log(err);
              req.flash('error', [ { message: 'Something went wrong' } ]);
              return res.redirect('/cart');
            }

            // Customer may decline email contact
            if (req.body.email && req.body.email.trim()) {

              // Get email text content
              ejs.renderFile(`${__dirname}/../views/mailer/${buyerTextTemplate}`, { cart: req.session.cart }, (err, textEmail) => {
                if (err) {
                  console.log(err);
                  req.flash('error', [ { message: 'Something went wrong' } ]);
                  return res.redirect('/cart');
                }

                // Get email HTML content 
                ejs.renderFile(`${__dirname}/../views/mailer/${buyerHtmlTemplate}`, { cart: req.session.cart }, (err, htmlEmail) => {
                  if (err) {
                    console.log(err);
                    req.flash('error', [ { message: 'Something went wrong' } ]);
                    return res.redirect('/cart');
                  }
  
                  // Inline CSS processing
                  styliner.processHTML(htmlEmail).then((htmlAndCss) => {
       
                    let mailOptions = {
                      to: process.env.TOR ? process.env.FROM : req.body.email,
                      from: process.env.TOR ? req.body.email : process.env.FROM,
                      subject: `Order received - ${orderPaid ? 'here is your receipt' : 'payment instructions'}`,
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
                      if (orderPaid) {
                        req.flash('success', `Your order has been received. An email copy of this receipt will be sent to ${req.body.email}`);
                        return res.redirect('/cart/receipt');
                      }
                      Cart.emptyCart(cart);
                      req.flash('success', `Your order has been received. Transaction instructions will be sent to ${req.body.email}`);
                      res.redirect('/');
                    });
                  }).catch((err) => {
                    console.log(err);
                    req.flash('error', [ { message: 'Something went wrong' } ]);
                    return res.redirect('/cart');
                  });
                });
              });
            }
            else {
              req.flash('success', 'Your order has been received. Print this receipt for your records.');
              res.redirect('/cart/receipt');
            }
          });
        }).catch((err) => {
          console.log(err);
          req.flash('error', [ { message: 'Something went wrong' } ]);
          return res.redirect('/cart');
        });
      });
    });
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
      path: req.originalUrl,
      messages: req.flash(),
      referrer: req.get('Referrer')
    });
    return;
  }

  cart = Object.assign({}, cart);
  Cart.emptyCart(req.session.cart);

  res.render('receipt', {
    path: req.originalUrl,
    cart: cart,
    messages: req.flash()
  });
});

module.exports = router;
