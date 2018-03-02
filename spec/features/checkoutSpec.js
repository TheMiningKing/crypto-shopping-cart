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

  let browser;

  afterEach((done) => {
    models.dropDatabase(() => {
      done();
    });
  });

  describe('when cart contains products', () => {
    let products;

    beforeEach((done) => {
      browser = new Browser({ waitDuration: '30s', loadCss: false });

      fixtures.load(__dirname + '/../fixtures/products.js', models.mongoose, (err) => {
        if (err) done.fail(err);

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
                  done();
                });
              });
            });
          });
        });
      });
    });

    it('displays an order submission form', () => {
      browser.assert.element('form.form-horizontal[action="/cart/checkout"]');
      browser.assert.element('form.form-horizontal input[type="text"][name="transaction"]');
      browser.assert.element('form.form-horizontal input[type="text"][name="recipient"]');
      browser.assert.element('form.form-horizontal input[type="text"][name="street"]');
      browser.assert.element('form.form-horizontal input[type="text"][name="city"]');
      browser.assert.element('form.form-horizontal input[type="text"][name="province"]');
      browser.assert.element('form.form-horizontal input[type="text"][name="country"]');
      browser.assert.element('form.form-horizontal input[type="text"][name="postcode"]');
      browser.assert.element('form.form-horizontal input[type="checkbox"][checked="checked"][name="contact"]');
      browser.assert.element('form.form-horizontal input[type="email"][name="email"]');
      browser.assert.element('form.form-horizontal button[type="submit"]');
    });

    describe('order entry and validation', () => {
      beforeEach(() => {
        browser.fill('transaction', '0x50m3crazy1d');
        browser.fill('recipient', 'Anonymous');
        browser.fill('street', '123 Fake St');
        browser.fill('city', 'The C-Spot');
        browser.fill('province', 'AB');
        browser.fill('country', 'Canada');
        browser.fill('postcode', 'T1K-5B3');
        browser.check('contact');
        browser.fill('email', 'me@example.com');
      });

      it('reports an error if transaction ID is omitted', (done) => {
        browser.fill('transaction', '').pressButton('Place Order', () => {
          browser.assert.url('/cart');  
          browser.assert.text('.alert-danger', 'You must provide a transaction ID');
          done();
        });
      });

      it('reports an error if recipient is omitted', (done) => {
        browser.fill('recipient', '').pressButton('Place Order', () => {
          browser.assert.url('/cart');  
          browser.assert.text('.alert-danger', 'You must provide a recipient');
          done();
        });
      });

      it('reports an error if street is omitted', (done) => {
        browser.fill('street', '').pressButton('Place Order', () => {
          browser.assert.url('/cart');  
          browser.assert.text('.alert-danger', 'You must provide a street');
          done();
        });
      });

      it('reports an error if city is omitted', (done) => {
        browser.fill('city', '').pressButton('Place Order', () => {
          browser.assert.url('/cart');  
          browser.assert.text('.alert-danger', 'You must provide a city');
          done();
        });
      });

      it('reports an error if province is omitted', (done) => {
        browser.fill('province', '').pressButton('Place Order', () => {
          browser.assert.url('/cart');  
          browser.assert.text('.alert-danger', 'You must provide a province');
          done();
        });
      });

      it('reports an error if country is omitted', (done) => {
        browser.fill('country', '').pressButton('Place Order', () => {
          browser.assert.url('/cart');  
          browser.assert.text('.alert-danger', 'You must provide a country');
          done();
        });
      });

      it('reports an error if postal code is omitted', (done) => {
        browser.fill('postcode', '').pressButton('Place Order', () => {
          browser.assert.url('/cart');  
          browser.assert.text('.alert-danger', 'You must provide a postal code');
          done();
        });
      });

      it('reports an error if email confirmation is requested but omitted', (done) => {
        browser.check('contact').fill('email', '').pressButton('Place Order', () => {
          browser.assert.url('/cart');  
          browser.assert.text('.alert-danger', 'You must provide an email');
          done();
        });
      });

      it('does not report an error if email confirmation is not requested', (done) => {
        browser.uncheck('contact').fill('email', '').pressButton('Place Order', () => {
          browser.assert.url('/cart/receipt');  
          browser.assert.text('.alert-success', 'Your order has been received. Save this receipt for your records.');
          done();
        });
      });

      it('chains omitted fields', (done) => {
        browser.fill('transaction', '').fill('country', '').fill('email', '').pressButton('Place Order', () => {
          browser.assert.url('/cart');  
          browser.assert.text('.alert-danger', 'You must provide a transaction ID, country, email');
          done();
        });
      });

      it('repopulates correctly-entered fields', (done) => {
        browser.fill('transaction', '').fill('country', '').fill('email', '').pressButton('Place Order', () => {
          browser.assert.url('/cart');  
          browser.assert.input('transaction', '');
          browser.assert.input('recipient', 'Anonymous');
          browser.assert.input('street', '123 Fake St');
          browser.assert.input('city', 'The C-Spot');
          browser.assert.input('province', 'AB');
          browser.assert.input('country', '');
          browser.assert.input('postcode', 'T1K-5B3');
          browser.assert.input('email', '');
          done();
        });
      });
    });

    describe('order processing', () => {
      let cart;

      beforeEach((done) => {
        browser.assert.url('/cart');
        models.collection('sessions').findOne({}, (err, result) => {
          if (err) {
            done.fail(err);
          }
          cart = result.session.cart;
          expect(cart.items.length).toEqual(2);

          browser.fill('transaction', '0x50m3crazy1d');
          browser.fill('recipient', 'Anonymous');
          browser.fill('street', '123 Fake St');
          browser.fill('city', 'The C-Spot');
          browser.fill('province', 'AB');
          browser.fill('country', 'Canada');
          browser.fill('postcode', 'T1K-5B3');
 
          done();
        });
      });

      afterEach((done) => {
        mailer.transport.sentMail = [];
        done();
      });
 
      describe('vendor experience', () => {
      });

      describe('customer experience', () => {

        describe('customer does not request email confirmation', () => {
        });
  
        describe('customer requests email confirmation', () => {
  
          beforeEach(() => {
            browser.check('contact');
            browser.fill('email', 'dan@example.com');
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
              browser.assert.text('.alert-success', 'An email has been sent to dan@example.com with transaction and shipping instructions');  
            });
      
            it('sends an email with correct header information to the buyer', () => {
              expect(mailer.transport.sentMail.length).toEqual(1);
              expect(mailer.transport.sentMail[0].data.to).toEqual('dan@example.com');
              expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.FROM);
              expect(mailer.transport.sentMail[0].data.subject).toEqual('Order received - payment and shipping instructions');
            });
      
            it('sends an email with text content to the buyer', () => {
              const text = mailer.transport.sentMail[0].data.text;
              expect(text).toContain('Thank you!');
              expect(text).toContain(
                `1. ${cart.items[0].name} - ${cart.items[0].option}, ${cart.items[0].formattedPrice}`);
              expect(text).toContain(`2. ${cart.items[1].name}, ${cart.items[1].formattedPrice}`);
              expect(text).toContain(`TOTAL: ${cart.formattedTotal} ${process.env.CURRENCY}`);
      
              expect(text).toContain(`Send ${cart.formattedTotal} ${process.env.CURRENCY} to ${process.env.WALLET}`);
            });
      
            it('sends an email with html content to the buyer', (done) => {
              const html = mailer.transport.sentMail[0].data.html;
              expect(html).toContain('<h3>Thank you!</h3>');
      
              expect(html).toContain(`<img src="cid:${cart.items[0].image}"`);
              expect(html).toContain(cart.items[0].name);
              expect(html).toContain(`- ${cart.items[0].option}`);
              expect(html).toContain(cart.items[0].formattedPrice);
      
              expect(html).toContain(`<img src="cid:${cart.items[1].image}"`);
              expect(html).toContain(cart.items[1].name);
              expect(html).toContain(cart.items[1].formattedPrice);
       
              expect(html).toContain(`Total: ${cart.formattedTotal} ${process.env.CURRENCY}`);
      
              // Send ___ ETH to ___ 
              expect(html).toContain(`${cart.formattedTotal} ${process.env.CURRENCY}`);
              expect(html).toContain(`${process.env.WALLET}`);
      
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
      
              // Wallet address
              QRCode.toDataURL(process.env.WALLET, (err, url) => {
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
                expect(results[0].session.cart.totals).toEqual(0);
                expect(results[0].session.cart.formattedTotal).toEqual(0);
      
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
                  
                          browser.fill('transaction', '0x50m3crazy1d');
                          browser.fill('recipient', 'Anonymous');
                          browser.fill('street', '123 Fake St');
                          browser.fill('city', 'The C-Spot');
                          browser.fill('province', 'AB');
                          browser.fill('country', 'Canada');
                          browser.fill('postcode', 'T1K-5B3');
                          browser.check('contact');
                          browser.fill('email', 'dan@example.com').pressButton('Place Order', () => {
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
              const html = mailer.transport.sentMail[0].data.html;
              expect(html).toContain('<h3>Thank you!</h3>');
      
              expect(html).toContain(`<img src="cid:${cart.items[0].image}"`);
              expect(html).toContain(cart.items[0].name);
              expect(html).toContain(`- ${cart.items[0].option}`);
              expect(html).toContain(cart.items[0].formattedPrice);
      
              expect(html).toContain(`<img src="cid:${cart.items[1].image}"`);
              expect(html).toContain(cart.items[1].name);
              expect(html).toContain(cart.items[1].formattedPrice);
       
              expect(html).toContain(`Total: ${cart.formattedTotal} ${process.env.CURRENCY}`);
      
              // Send ___ ETH to ___ 
              expect(html).toContain(`${cart.formattedTotal} ${process.env.CURRENCY}`);
              expect(html).toContain(`${process.env.WALLET}`);
      
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
      
              // Wallet address
              QRCode.toDataURL(process.env.WALLET, (err, url) => {
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