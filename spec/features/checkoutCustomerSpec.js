'use strict';                  

const app = require('../../app'); 
const models = require('../../models');
const mailer = require('../../mailer');
const fixtures = require('pow-mongoose-fixtures');
const Units = require('ethereumjs-units');
const path = require('path');
const QRCode = require('qrcode')

const Browser = require('zombie');
const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001; 
Browser.localhost('example.com', PORT);

describe('checkout', () => {

  let browser, products, _wallets;
  beforeEach((done) => {
    browser = new Browser({ waitDuration: '30s', loadCss: false });

    fixtures.load(__dirname + '/../fixtures/wallets.js', models.mongoose, (err) => {
      if (err) done.fail(err);

      fixtures.load(__dirname + '/../fixtures/products.js', models.mongoose, (err) => {
        if (err) done.fail(err);
  
        models.Wallet.find({}).sort('createdAt').then((results) => {
          _wallets = results;
          models.Product.find({}).sort('createdAt').then((results) => {
            products = results;
            done();
          }).catch((err) => {
            done.fail(err);
          });
        }).catch((err) => {
          done.fail(err);
        });
      });
    });
  });

  afterEach((done) => {
    models.dropDatabase(() => {
      mailer.transport.sentMail = [];
      done();
    });
  });

  describe('when cart contains products', () => {
    beforeEach((done) => {
      browser.visit('/', (err) => {
        if (err) done.fail(err);

        browser.pressButton('li.product:nth-child(1) form button[type=submit]', () => {

          browser.visit('/', (err) => {
            if (err) done.fail(err);

            browser.pressButton('li.product:nth-child(2) form button[type=submit]', () => {
              browser.assert.redirected();
              browser.assert.url('/cart');
              done();
            });
          });
        });
      });
    });

    describe('order processing', () => {
      const _order = {
        transaction: '0x50m3crazy1d',
        recipient: 'Anonymous',
        street: '123 Fake St',
        city: 'The C-Spot',
        province: 'AB',
        country: 'Canada',
        postcode: 'T1K-5B3',
        contact: '1',
        email: 'me@example.com'
      };

      let cart;

      beforeEach((done) => {
        browser.assert.url('/cart');
        models.collection('sessions').findOne({}, (err, result) => {
          if (err) {
            done.fail(err);
          }
          cart = result.session.cart;
          expect(cart.items.length).toEqual(2);

          browser.fill('recipient', _order.recipient);
          browser.fill('street', _order.street);
          browser.fill('city', _order.city);
          browser.fill('province', _order.province);
          browser.fill('country', _order.country);
          browser.fill('postcode', _order.postcode);
 
          done();
        });
      });

      describe('customer experience', () => {

        describe('customer requests no email confirmation', () => {
          beforeEach((done) => {
            browser.uncheck('contact');
            browser.fill('transaction', _order.transaction);
            browser.fill('email', '  ').pressButton('Place Order', () => {
              browser.assert.success();
              browser.assert.url('/cart/receipt');
              done();
            });
          });

          it('displays a relevant flash message', () => {
            browser.assert.text('.alert-success', 'Your order has been received. Print this receipt for your records.');
          });

          it('shows the correct cart links', () => {
            browser.assert.link('.navbar-header a.navbar-brand', 'Continue shopping', '/');
            browser.assert.elements('i.fa.fa-shopping-cart.go-to-cart-lnk', 0);
          });

          it('displays the products ordered', () => {
            browser.assert.elements('tr', 3);
            browser.assert.element(`tr:nth-child(1) td.product-thumb img[src="/images/products/${products[0].images[0]}"]`);
            browser.assert.text('tr:nth-child(1) td:nth-child(2)', `${products[0].name} - ${products[0].options[0]}`);
            browser.assert.text('tr:nth-child(1) td:nth-child(3)', products[0].prices[0].formattedPrice);
      
            browser.assert.element(`tr:nth-child(2) td.product-thumb img[src="/images/products/${products[1].images[0]}"]`);
            browser.assert.text('tr:nth-child(2) td:nth-child(2)', products[1].name);
            browser.assert.text('tr:nth-child(2) td:nth-child(3)', products[1].prices[0].formattedPrice);
      
            browser.assert.text('tr.info',
                `${Number(Units.convert(products[0].prices[0].price * 2, 'gwei', 'eth'))} ${process.env.PREFERRED_CURRENCY}`);
          });

          // Flaky
          it('displays a QR code and transaction ID', (done) => {
            QRCode.toString(_order.transaction, { type: 'svg' }, (err, svg) => {
              if (err) done.fail(err);
              browser.assert.element('svg');
              browser.assert.elements('path', 2);
              browser.assert.text('#transaction', _order.transaction);
              done();
            });
          });

          it('displays customer\'s shipping details', () => {
            browser.assert.text('.shipping-info header',
                'Once your transaction has been verified, your order will be processed and shipped to:');
            browser.assert.text('.shipping-info section .recipient', _order.recipient);
            browser.assert.text('.shipping-info section .street', _order.street);
            browser.assert.text('.shipping-info section .city', _order.city);
            browser.assert.text('.shipping-info section .province', _order.province);
            browser.assert.text('.shipping-info section .postcode', _order.postcode);
            browser.assert.text('.shipping-info section .email', 'You declined to provide an email');
            browser.assert.text('.shipping-info footer div:nth-child(1)', `Send questions to ${process.env.FROM}`);
            browser.assert.text('.shipping-info footer div:nth-child(2)', 'Keep this order for your records.');
          });

          it('empties the shopping cart', (done) => {
            models.collection('sessions').find({}).toArray((err, results) => {
              if (err) {
                done.fail(err);
              }
              expect(results.length).toEqual(1);
              expect(results[0].session.cart.items.length).toEqual(0);
              expect(results[0].session.cart.totals).toEqual({});
    
              done();
            });
          });
        });
  
        describe('customer requests no email confirmation but provides email anyway', () => {
          beforeEach((done) => {
            browser.uncheck('contact');
            browser.fill('transaction', _order.transaction);
            browser.fill('email', _order.email).pressButton('Place Order', () => {
              browser.assert.success();
              browser.assert.url('/cart/receipt');
              done();
            });
          });

          it('displays a relevant flash message', () => {
            browser.assert.text('.alert-success',
                                `Your order has been received. An email copy of this receipt will be sent to ${_order.email}`);
          });

          it('shows the correct cart links', () => {
            browser.assert.link('.navbar-header a.navbar-brand', 'Continue shopping', '/');
            browser.assert.elements('i.fa.fa-shopping-cart.go-to-cart-lnk', 0);
          });

          it('displays the products ordered', () => {
            browser.assert.elements('tr', 3);
            browser.assert.element(`tr:nth-child(1) td.product-thumb img[src="/images/products/${products[0].images[0]}"]`);
            browser.assert.text('tr:nth-child(1) td:nth-child(2)', `${products[0].name} - ${products[0].options[0]}`);
            browser.assert.text('tr:nth-child(1) td:nth-child(3)', products[0].prices[0].formattedPrice);
      
            browser.assert.element(`tr:nth-child(2) td.product-thumb img[src="/images/products/${products[1].images[0]}"]`);
            browser.assert.text('tr:nth-child(2) td:nth-child(2)', products[1].name);
            browser.assert.text('tr:nth-child(2) td:nth-child(3)', products[1].prices[0].formattedPrice);
      
            browser.assert.text('tr.info',
                `${Number(Units.convert(products[0].prices[0].price * 2, 'gwei', 'eth'))} ${process.env.PREFERRED_CURRENCY}`);
          });

          // Flaky
          it('displays a QR code and transaction ID', (done) => {
            QRCode.toString(_order.transaction, { type: 'svg' }, (err, svg) => {
              if (err) done.fail(err);
              browser.assert.element('svg');
              browser.assert.elements('path', 2);
              browser.assert.text('#transaction', _order.transaction);
              done();
            });
          });

          it('displays customer\'s shipping details', () => {
            browser.assert.text('.shipping-info header',
                'Once your transaction has been verified, your order will be processed and shipped to:');
            browser.assert.text('.shipping-info section .recipient', _order.recipient);
            browser.assert.text('.shipping-info section .street', _order.street);
            browser.assert.text('.shipping-info section .city', _order.city);
            browser.assert.text('.shipping-info section .province', _order.province);
            browser.assert.text('.shipping-info section .postcode', _order.postcode);
            browser.assert.text('.shipping-info section .email', _order.email);
            browser.assert.text('.shipping-info footer div:nth-child(1)', `Send questions to ${process.env.FROM}`);
            browser.assert.text('.shipping-info footer div:nth-child(2)', 'Keep this order for your records.');
          });

          it('empties the shopping cart', (done) => {
            models.collection('sessions').find({}).toArray((err, results) => {
              if (err) {
                done.fail(err);
              }
              expect(results.length).toEqual(1);
              expect(results[0].session.cart.items.length).toEqual(0);
              expect(results[0].session.cart.totals).toEqual({});
    
              done();
            });
          });

          it('sends an email with correct header information to the buyer', () => {
            expect(mailer.transport.sentMail.length).toEqual(2);
            expect(mailer.transport.sentMail[1].data.to).toEqual(_order.email);
            expect(mailer.transport.sentMail[1].data.from).toEqual(process.env.FROM);
            expect(mailer.transport.sentMail[1].data.subject).toEqual('Order received - here is your receipt');
          });

          it('sends an email with correct header information to the vendor', () => {
            expect(mailer.transport.sentMail.length).toEqual(2);
            expect(mailer.transport.sentMail[0].data.to).toEqual(process.env.FROM);
            expect(mailer.transport.sentMail[0].data.from).toEqual(_order.email);
            expect(mailer.transport.sentMail[0].data.subject).toEqual('New order received');
          });
    
          it('sends an email with text content to the buyer', () => {
            const text = mailer.transport.sentMail[1].data.text;
            expect(text).toContain('Thank you!');
            expect(text).toContain(
              `1. ${cart.items[0].name} - ${cart.items[0].option}, ${cart.items[0].prices[process.env.PREFERRED_CURRENCY].formattedPrice}`);
            expect(text).toContain(`2. ${cart.items[1].name}, ${cart.items[1].prices[process.env.PREFERRED_CURRENCY].formattedPrice}`);
            expect(text).toContain(`TOTAL: ${cart.totals[process.env.PREFERRED_CURRENCY].formattedTotal} ${process.env.PREFERRED_CURRENCY}`);
    
            expect(text).toContain(`You sent ${cart.totals[process.env.PREFERRED_CURRENCY].formattedTotal} ${process.env.PREFERRED_CURRENCY} to ${_wallets[0].address}`);
            expect(text).toContain(`Your transaction ID: ${_order.transaction}`);
            expect(text).toContain('You will receive confirmation and a tracking number once your order is processed.');

            expect(text).toContain('Your order will be shipped to:');
            expect(text).toContain(_order.recipient);
            expect(text).toContain(_order.street);
            expect(text).toContain(_order.city);
            expect(text).toContain(_order.province);
            expect(text).toContain(_order.postcode);
            expect(text).toContain('Reply to this email with questions');
          });
    
          it('sends an email with html content to the buyer', (done) => {
            const html = mailer.transport.sentMail[1].data.html;
            expect(html).toContain('<h3>Thank you!</h3>');
    
            expect(html).toContain(`<img src="cid:${cart.items[0].image}"`);
            expect(html).toContain(cart.items[0].name);
            expect(html).toContain(`- ${cart.items[0].option}`);
            expect(html).toContain(cart.items[0].prices[process.env.PREFERRED_CURRENCY].formattedPrice);
    
            expect(html).toContain(`<img src="cid:${cart.items[1].image}"`);
            expect(html).toContain(cart.items[1].name);
            expect(html).toContain(cart.items[1].prices[process.env.PREFERRED_CURRENCY].formattedPrice);
     
            expect(html).toContain(`Total: ${cart.totals[process.env.PREFERRED_CURRENCY].formattedTotal} ${process.env.PREFERRED_CURRENCY}`);
    
            // You sent ___ ETH to ___ 
            expect(html).toContain(`${cart.totals[process.env.PREFERRED_CURRENCY].formattedTotal} ${process.env.PREFERRED_CURRENCY}`);
            expect(html).toContain(`${_wallets[0].address}`);

            // TransactionID
            expect(html).toContain(_order.transaction);

            // Shipping details
            expect(html).toContain('Once your transaction has been verified, your order will be processed and shipped to:');
            expect(html).toContain(_order.recipient);
            expect(html).toContain(_order.street);
            expect(html).toContain(_order.city);
            expect(html).toContain(_order.province);
            expect(html).toContain(_order.postcode);
            expect(html).toContain('Reply to this email with questions');

            // File attachments 
            const attachments = mailer.transport.sentMail[0].data.attachments;
            expect(attachments.length).toEqual(3);
            expect(attachments[0].filename).toEqual(cart.items[0].image);
            expect(attachments[0].path).toEqual(path.resolve(__dirname, '../../public/images/products', cart.items[0].image));
            expect(attachments[0].cid).toEqual(cart.items[0].image);
            expect(attachments[1].filename).toEqual(cart.items[1].image);
            expect(attachments[1].path).toEqual(path.resolve(__dirname, '../../public/images/products', cart.items[1].image));
            expect(attachments[1].cid).toEqual(cart.items[1].image);
            expect(attachments[1].filename).toEqual(cart.items[1].image);
            expect(attachments[1].path).toEqual(path.resolve(__dirname, '../../public/images/products', cart.items[1].image));
            expect(attachments[1].cid).toEqual(cart.items[1].image);
    
            // Transaction ID
            QRCode.toDataURL(_order.transaction, (err, url) => {
              if (err) done.fail(err);
              expect(attachments[2].path).toBe(false);
              expect(attachments[2].cid).toEqual('qr.png');
              expect(attachments[2].contentType).toEqual('image/png');
              expect(Buffer.compare(attachments[2].content, new Buffer(url.split("base64,")[1], "base64"))).toEqual(0);
              expect(html).toContain('<img src="cid:qr.png">');
              done();
            });
          });
        });

        describe('customer requests email transaction', () => {
  
          beforeEach(() => {
            browser.check('contact');
            browser.fill('transaction', '   ');
            browser.fill('email', _order.email);
          });
 
          describe('all products are distinct', () => {
  
            beforeEach((done) => {
              browser.pressButton('Place Order', () => {
                browser.assert.success();  
                done();
              });
            });
      
            it('redirects and displays a flash message on the homepage', () => {
              browser.assert.redirected();
              browser.assert.url('/');
              browser.assert.text('.alert-success', `Your order has been received. Transaction instructions will be sent to ${_order.email}`);
            });

            it('sends an email with correct header information to the vendor', () => {
              expect(mailer.transport.sentMail.length).toEqual(2);
              expect(mailer.transport.sentMail[0].data.to).toEqual(process.env.FROM);
              expect(mailer.transport.sentMail[0].data.from).toEqual(_order.email);
              expect(mailer.transport.sentMail[0].data.subject).toEqual('New order received - unpaid');
            });

            it('sends an email with correct header information to the buyer', () => {
              expect(mailer.transport.sentMail.length).toEqual(2);
              expect(mailer.transport.sentMail[1].data.to).toEqual(_order.email);
              expect(mailer.transport.sentMail[1].data.from).toEqual(process.env.FROM);
              expect(mailer.transport.sentMail[1].data.subject).toEqual('Order received - payment instructions');
            });
      
            it('sends an email with text content to the buyer', () => {
              const text = mailer.transport.sentMail[1].data.text;
              expect(text).toContain('Thank you!');
              expect(text).toContain(
                `1. ${cart.items[0].name} - ${cart.items[0].option}, ${cart.items[0].prices[process.env.PREFERRED_CURRENCY].formattedPrice}`);
              expect(text).toContain(`2. ${cart.items[1].name}, ${cart.items[1].prices[process.env.PREFERRED_CURRENCY].formattedPrice}`);
              expect(text).toContain(`TOTAL: ${cart.totals[process.env.PREFERRED_CURRENCY].formattedTotal} ${process.env.PREFERRED_CURRENCY}`);
      
              expect(text).toContain(`Send ${cart.totals[process.env.PREFERRED_CURRENCY].formattedTotal} ${process.env.PREFERRED_CURRENCY} to ${_wallets[0].address}`);
              expect(text).toContain('When your transaction is verified, you will receive confirmation and a tracking number once your order is processed');

              expect(text).toContain('Your order will be shipped to:');
              expect(text).toContain(_order.recipient);
              expect(text).toContain(_order.street);
              expect(text).toContain(_order.city);
              expect(text).toContain(_order.province);
              expect(text).toContain(_order.postcode);
              expect(text).toContain(_order.country);
              expect(text).toContain('Reply to this email with your transaction ID and any questions');
            });
      
            it('sends an email with html content to the buyer', (done) => {
              const html = mailer.transport.sentMail[1].data.html;
              expect(html).toContain('<h3>Thank you!</h3>');
      
              expect(html).toContain(`<img src="cid:${cart.items[0].image}"`);
              expect(html).toContain(cart.items[0].name);
              expect(html).toContain(`- ${cart.items[0].option}`);
              expect(html).toContain(cart.items[0].prices[process.env.PREFERRED_CURRENCY].formattedPrice);
      
              expect(html).toContain(`<img src="cid:${cart.items[1].image}"`);
              expect(html).toContain(cart.items[1].name);
              expect(html).toContain(cart.items[1].prices[process.env.PREFERRED_CURRENCY].formattedPrice);
       
              expect(html).toContain(`Total: ${cart.totals[process.env.PREFERRED_CURRENCY].formattedTotal} ${process.env.PREFERRED_CURRENCY}`);
      
              // Send ___ ETH to ___ 
              expect(html).toContain(`${cart.totals[process.env.PREFERRED_CURRENCY].formattedTotal} ${process.env.PREFERRED_CURRENCY}`);
              expect(html).toContain(`${_wallets[0].address}`);

              // Wallet Address 
              expect(html).toContain(_wallets[0].address);

              // Shipping details
              expect(html).toContain('Once your transaction has been verified, your order will be processed and shipped to:');
              expect(html).toContain(_order.recipient);
              expect(html).toContain(_order.street);
              expect(html).toContain(_order.city);
              expect(html).toContain(_order.province);
              expect(html).toContain(_order.postcode);
              expect(html).toContain(_order.country);
              expect(html).toContain('Reply to this email with your transaction ID.');

              // File attachments 
              const attachments = mailer.transport.sentMail[0].data.attachments;
              expect(attachments.length).toEqual(3);
              expect(attachments[0].filename).toEqual(cart.items[0].image);
              expect(attachments[0].path).toEqual(path.resolve(__dirname, '../../public/images/products', cart.items[0].image));
              expect(attachments[0].cid).toEqual(cart.items[0].image);
              expect(attachments[1].filename).toEqual(cart.items[1].image);
              expect(attachments[1].path).toEqual(path.resolve(__dirname, '../../public/images/products', cart.items[1].image));
              expect(attachments[1].cid).toEqual(cart.items[1].image);
              expect(attachments[1].filename).toEqual(cart.items[1].image);
              expect(attachments[1].path).toEqual(path.resolve(__dirname, '../../public/images/products', cart.items[1].image));
              expect(attachments[1].cid).toEqual(cart.items[1].image);
      
              // Wallet ID
              QRCode.toDataURL(_wallets[0].address, (err, url) => {
                if (err) done.fail(err);
                expect(attachments[2].path).toBe(false);
                expect(attachments[2].cid).toEqual('qr.png');
                expect(attachments[2].contentType).toEqual('image/png');
                expect(Buffer.compare(attachments[2].content, new Buffer(url.split("base64,")[1], "base64"))).toEqual(0);
                expect(html).toContain('<img src="cid:qr.png">');
                done();
              });
            });
      
            it('empties the buyer\'s cart', (done) => {
              models.collection('sessions').find({}).toArray((err, results) => {
                if (err) {
                  done.fail(err);
                }
                expect(results.length).toEqual(1);
                expect(results[0].session.cart.items.length).toEqual(0);
                expect(results[0].session.cart.totals).toEqual({});
      
                done();
              });
            });
          });
    
          describe('contains duplicate products', () => {
            beforeEach((done) => {
              models.Product.find({}).sort('createdAt').then((results) => {
                products = results;
      
                browser.visit('/', (err) => {
                  if (err) done.fail(err);
      
                  browser.pressButton('li.product:nth-child(1) form button[type=submit]', () => {
      
                    browser.visit('/', (err) => {
                      if (err) done.fail(err);
      
                      browser.pressButton('li.product:nth-child(2) form button[type=submit]', () => {
                        browser.assert.redirected();
                        browser.assert.url('/cart');
    
                        models.collection('sessions').findOne({}, (err, result) => {
                          if (err) {
                            done.fail(err);
                          }
                          cart = result.session.cart;
                          expect(cart.items.length).toEqual(4);
                  
                          //browser.fill('transaction', _order.transaction);
                          browser.fill('recipient', _order.recipient);
                          browser.fill('street', _order.street);
                          browser.fill('city', _order.city);
                          browser.fill('province', _order.province);
                          browser.fill('country', _order.country);
                          browser.fill('postcode', _order.postcode);
                          browser.check('contact');
                          browser.fill('email', _order.email).pressButton('Place Order', () => {
                            browser.assert.success();  
                            done();
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
  
            it('does not attach duplicate product images to the HTML email', (done) => {
              const html = mailer.transport.sentMail[1].data.html;
              expect(html).toContain('<h3>Thank you!</h3>');

              expect(html).toContain(`<img src="cid:${cart.items[0].image}"`);
              expect(html).toContain(cart.items[0].name);
              expect(html).toContain(`- ${cart.items[0].option}`);
              expect(html).toContain(cart.items[0].prices[process.env.PREFERRED_CURRENCY].formattedPrice);

              expect(html).toContain(`<img src="cid:${cart.items[1].image}"`);
              expect(html).toContain(cart.items[1].name);
              expect(html).toContain(cart.items[1].prices[process.env.PREFERRED_CURRENCY].formattedPrice);

              expect(html).toContain(`Total: ${cart.totals[process.env.PREFERRED_CURRENCY].formattedTotal} ${process.env.PREFERRED_CURRENCY}`);

              // Send ___ ETH to ___
              expect(html).toContain(`${cart.totals[process.env.PREFERRED_CURRENCY].formattedTotal} ${process.env.PREFERRED_CURRENCY}`);
              expect(html).toContain(`${process.env.PREFERRED_CURRENCY}`);

              // TransactionID
              expect(html).not.toContain(_order.transaction);

              // Shipping details
              expect(html).toContain('Once your transaction has been verified, your order will be processed and shipped to:');
              expect(html).toContain(_order.recipient);
              expect(html).toContain(_order.street);
              expect(html).toContain(_order.city);
              expect(html).toContain(_order.province);
              expect(html).toContain(_order.country);
              expect(html).toContain(_order.postcode);
              expect(html).toContain('Reply to this email with your transaction ID.');

              // Attachments
              const attachments = mailer.transport.sentMail[0].data.attachments;
              expect(attachments.length).toEqual(3);
              expect(attachments[0].filename).toEqual(cart.items[0].image);
              expect(attachments[0].path).toEqual(path.resolve(__dirname, '../../public/images/products', cart.items[0].image));
              expect(attachments[0].cid).toEqual(cart.items[0].image);
              expect(attachments[1].filename).toEqual(cart.items[1].image);
              expect(attachments[1].path).toEqual(path.resolve(__dirname, '../../public/images/products', cart.items[1].image));
              expect(attachments[1].cid).toEqual(cart.items[1].image);

              // Wallet
              QRCode.toDataURL(_wallets[0].address, (err, url) => {
                if (err) done.fail(err);
                expect(attachments[2].path).toBe(false);
                expect(attachments[2].cid).toEqual('qr.png');
                expect(attachments[2].contentType).toEqual('image/png');
                expect(Buffer.compare(attachments[2].content, new Buffer(url.split("base64,")[1], "base64"))).toEqual(0);
                expect(html).toContain('<img src="cid:qr.png">');
                done();
              });
            });
          });
        });
      });
    });
  });
});
