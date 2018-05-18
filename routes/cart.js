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
  models.Wallet.find().sort('createdAt').then((wallets) => {
    let preferredWallet;
    wallets.forEach((wallet, i) => {
      if (wallet.currency === req.session.cart.preferredCurrency) {
        preferredWallet = wallet;
      }
    }); // It's left to the developer to ensure only one wallet for each currency

    QRCode.toString(preferredWallet ? preferredWallet.address : 'This is not a valid address!!!',
      { type: 'svg' }, (err, url) => {

      if (err) {
        console.log(err);
      }
  
      res.render('cart', {
        path: req.originalUrl,
        cart: req.session.cart,
        messages: req.flash(),
        details: {},
        referrer: req.get('Referrer') || '/',
        qr: url,
        wallets: wallets,
        preferredWallet: preferredWallet
      });
    });
  }).catch((error) => {
    req.flash('error', [ { message: 'Something went wrong' } ]);
    return res.redirect('/cart');
  });
});

/**
 * POST /
 */
router.post('/', (req, res) => {
  models.Product.findOne({_id: req.body.id}).populate('prices.wallet').then(prod => {
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
  models.Wallet.findOne({ currency: req.session.cart.preferredCurrency }).then((wallet) => {

    // Validate order form
    const errors = validator(req.body);
    if (errors) {
      QRCode.toString(wallet.address, { type: 'svg' }, (err, url) => {
        if (err) {
          console.log(err);
        }
  
        models.Wallet.find().then((wallets) => {
          res.render('cart', {
            path: req.originalUrl,
            cart: req.session.cart,
            messages: { error: errors },
            qr: url,
            referrer: req.get('Referrer'),
            details: req.body,
            wallets: wallets,
            preferredWallet: wallet
          });
        }).catch((error) => {
          req.flash('error', [ { message: 'Something went wrong' } ]);
          return res.redirect('/cart');
        });
      });
    }
    else {
  
      Cart.purchase(req.body, req.session.cart);
  
      // Determine appropriate mailer templates
      const orderPaid = req.body.transaction && req.body.transaction.trim();
      let vendorTextTemplate = 'vendorUnpaidText.ejs';
      let vendorHtmlTemplate = 'vendorUnpaidHtml.ejs';
      let buyerTextTemplate = 'orderUnpaidText.ejs';
      let buyerHtmlTemplate = 'orderUnpaidHtml.ejs';
      let qrString = wallet.address;
      if (orderPaid) {
        vendorTextTemplate = 'vendorText.ejs';
        vendorHtmlTemplate = 'vendorHtml.ejs';
        buyerTextTemplate = 'orderText.ejs';
        buyerHtmlTemplate = 'orderHtml.ejs';
        qrString = req.body.transaction;
      }
  
      // Get vendor text content 
      ejs.renderFile(`${__dirname}/../views/mailer/${vendorTextTemplate}`, { cart: req.session.cart, wallet: wallet }, (err, textVendor) => {
        if (err) {
          console.log(err);
          req.flash('error', [ { message: 'Something went wrong' } ]);
          return res.redirect('/cart');
        }
  
        // Generate QR code for transaction or wallet
        QRCode.toDataURL(qrString, (err, qr) => {
          if (err) {
            console.log(err);
          }
  
          // Get vendor HTML content 
          ejs.renderFile(`${__dirname}/../views/mailer/${vendorHtmlTemplate}`, { cart: req.session.cart, qr: qr, wallet: wallet }, (err, htmlVendor) => {
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
  
              // Attach QR
              attachments.push({
                path: qr,
                cid: 'qr.png'
              });
   
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
                  ejs.renderFile(`${__dirname}/../views/mailer/${buyerTextTemplate}`, { cart: req.session.cart, wallet: wallet }, (err, textEmail) => {
                    if (err) {
                      console.log(err);
                      req.flash('error', [ { message: 'Something went wrong' } ]);
                      return res.redirect('/cart');
                    }
  
                    // Get email HTML content 
                    ejs.renderFile(`${__dirname}/../views/mailer/${buyerHtmlTemplate}`, { cart: req.session.cart, qr: qr, wallet: wallet }, (err, htmlEmail) => {
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
                          Cart.emptyCart(req.session.cart);
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
      });
    }
  }).catch((err) => {
    req.flash('error', [ { message: 'Something went wrong' } ]);
    return res.redirect('/cart');
  });
});

/**
 * GET /receipt
 */
router.get('/receipt', (req, res) => {

  if (!req.session.cart.order) {
    res.render('receipt', {
      cart: req.session.cart,
      path: req.originalUrl,
      referrer: req.get('Referrer') || '/',
      messages: req.flash()
    });
    return;
  }

  QRCode.toString(req.session.cart.order.transaction, { type: 'svg' }, (err, url) => {
    if (err) {
      console.log(err);
    }

    let cart = Object.assign({}, req.session.cart);
    Cart.emptyCart(req.session.cart);

    res.render('receipt', {
      path: req.originalUrl,
      cart: cart,
      referrer: req.get('Referrer') || '/',
      messages: req.flash(),
      qr: url
    });
  });
});

/**
 * GET /set-currency/:currency
 */
router.get('/set-currency/:currency', (req, res) => {
  models.Wallet.count({ currency: req.params.currency }).then((count) => {
    if (count) {
      req.session.cart.preferredCurrency = req.params.currency;
      req.flash('info', `Currency switched to ${req.session.cart.preferredCurrency}`);
      res.redirect(req.get('Referrer'));
      return;
    }
    req.flash('error', [ { message: `${req.params.currency} is not currently accepted` } ]);
    res.redirect('/');
  }).catch((err) => {
    req.flash('error', [ { message: 'Something went wrong' } ]);
    return res.redirect('/cart');
  });
});

module.exports = router;
