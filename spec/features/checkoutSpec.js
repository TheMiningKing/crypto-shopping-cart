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

  let browser, products;
  beforeEach((done) => {
    browser = new Browser({ waitDuration: '30s', loadCss: false });

    fixtures.load(__dirname + '/../fixtures/products.js', models.mongoose, (err) => {
      if (err) done.fail(err);

      models.Product.find({}).sort('createdAt').then((results) => {
        products = results;
        done();
      });
    });
  });

  afterEach((done) => {
    models.dropDatabase(() => {
      mailer.transport.sentMail = [];
      done();
    });
  });

  it('doesn\'t barf if there is no receipt', (done) => {
    browser.visit('/cart/receipt', (err) => {
      if (err) done.fail(err);
      browser.assert.url('/cart/receipt');
      browser.assert.text('.alert-info', 'No receipt here. Why not place an order?');
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
    }

    describe('order entry and validation', () => {
      beforeEach(() => {
        browser.fill('transaction', _order.transaction);
        browser.fill('recipient', _order.recipient);
        browser.fill('street', _order.street);
        browser.fill('city', _order.city);
        browser.fill('province', _order.province);
        browser.fill('country', _order.country);
        browser.fill('postcode', _order.postcode);
        browser.check('contact');
        browser.fill('email', _order.email);
      });

      it('reports an error if transaction ID is omitted', (done) => {
        browser.fill('transaction', '  ').pressButton('Place Order', () => {
          browser.assert.url('/cart/checkout');
          browser.assert.text('.alert-danger', 'You must provide a transaction ID');
          done();
        });
      });

      it('reports an error if recipient is omitted', (done) => {
        browser.fill('recipient', '  ').pressButton('Place Order', () => {
          browser.assert.url('/cart/checkout');
          browser.assert.text('.alert-danger', 'You must provide a recipient');
          done();
        });
      });

      it('reports an error if street is omitted', (done) => {
        browser.fill('street', '  ').pressButton('Place Order', () => {
          browser.assert.url('/cart/checkout');
          browser.assert.text('.alert-danger', 'You must provide a street');
          done();
        });
      });

      it('reports an error if city is omitted', (done) => {
        browser.fill('city', '  ').pressButton('Place Order', () => {
          browser.assert.url('/cart/checkout');
          browser.assert.text('.alert-danger', 'You must provide a city');
          done();
        });
      });

      it('reports an error if province is omitted', (done) => {
        browser.fill('province', '  ').pressButton('Place Order', () => {
          browser.assert.url('/cart/checkout');
          browser.assert.text('.alert-danger', 'You must provide a province');
          done();
        });
      });

      it('reports an error if country is omitted', (done) => {
        browser.fill('country', '  ').pressButton('Place Order', () => {
          browser.assert.url('/cart/checkout');
          browser.assert.text('.alert-danger', 'You must provide a country');
          done();
        });
      });

      it('reports an error if postal code is omitted', (done) => {
        browser.fill('postcode', '  ').pressButton('Place Order', () => {
          browser.assert.url('/cart/checkout');
          browser.assert.text('.alert-danger', 'You must provide a postal code');
          done();
        });
      });

      it('reports an error if email confirmation is requested but omitted', (done) => {
        browser.check('contact').fill('email', '   ').pressButton('Place Order', () => {
          browser.assert.url('/cart/checkout');
          browser.assert.text('.alert-danger', 'You requested email confirmation. You must provide an email.');
          done();
        });
      });

      it('does not report an error if email confirmation is not requested', (done) => {
        browser.uncheck('contact').fill('email', '  ').pressButton('Place Order', () => {
          browser.assert.url('/cart/receipt');
          browser.assert.text('.alert-success', 'Your order has been received. Print this receipt for your records.');
          done();
        });
      });

      it('chains omitted fields', (done) => {
        browser.fill('transaction', '   ').fill('country', '  ').fill('email', '').pressButton('Place Order', () => {
          browser.assert.url('/cart/checkout');
          browser.assert.text('.messages .alert:nth-child(1).alert-danger', 'You must provide a transaction ID, country');
          browser.assert.text('.messages .alert:nth-child(2).alert-danger', 'You requested email confirmation. You must provide an email.');
          done();
        });
      });

      it('repopulates correctly-entered fields', (done) => {
        browser.fill('transaction', '  ').fill('country', '  ').fill('email', '').pressButton('Place Order', () => {
          browser.assert.url('/cart/checkout');
          browser.assert.input('#transaction', '  ');
          browser.assert.input('#recipient', _order.recipient);
          browser.assert.input('#street', _order.street);
          browser.assert.input('#city', _order.city);
          browser.assert.input('#province', _order.province);
          browser.assert.input('#country', '  ');
          browser.assert.input('#postcode', _order.postcode);
          browser.assert.input('#email', '');
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

          browser.fill('transaction', _order.transaction);
          browser.fill('recipient', _order.recipient);
          browser.fill('street', _order.street);
          browser.fill('city', _order.city);
          browser.fill('province', _order.province);
          browser.fill('country', _order.country);
          browser.fill('postcode', _order.postcode);
 
          done();
        });
      });

      describe('vendor experience', () => {

        describe('customer does not request email confirmation', () => {

          beforeEach((done) => {
            browser.uncheck('contact');
            browser.fill('email', '').pressButton('Place Order', () => {
              browser.assert.success();
              browser.assert.url('/cart/receipt');
              done();
            });
          });

          it('sends an email with correct header information to the vendor', () => {
            expect(mailer.transport.sentMail.length).toEqual(1);
            expect(mailer.transport.sentMail[0].data.to).toEqual(process.env.FROM);
            expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.FROM);
            expect(mailer.transport.sentMail[0].data.subject).toEqual('New order received');
          });
    
          it('sends an email with text content to the vendor', () => {
            const text = mailer.transport.sentMail[0].data.text;
            expect(text).toContain(
              `1. ${cart.items[0].name} - ${cart.items[0].option}, ${cart.items[0].formattedPrice}`);
            expect(text).toContain(`2. ${cart.items[1].name}, ${cart.items[1].formattedPrice}`);
            expect(text).toContain(`TOTAL: ${cart.formattedTotal} ${process.env.CURRENCY}`);
    
            expect(text).toContain(`${cart.formattedTotal} ${process.env.CURRENCY} was sent to ${process.env.WALLET}`);
            expect(text).toContain(`Transaction ID: ${_order.transaction}`);

            expect(text).toContain('Shipping details:');
            expect(text).toContain(_order.recipient);
            expect(text).toContain(_order.street);
            expect(text).toContain(_order.city);
            expect(text).toContain(_order.province);
            expect(text).toContain(_order.postcode);
            expect(text).toContain('Customer declined email contact.');
          });
    
          it('sends an email with html content to the vendor', (done) => {
            const html = mailer.transport.sentMail[0].data.html;
            expect(html).toContain(`<img src="cid:${cart.items[0].image}"`);
            expect(html).toContain(cart.items[0].name);
            expect(html).toContain(`- ${cart.items[0].option}`);
            expect(html).toContain(cart.items[0].formattedPrice);
    
            expect(html).toContain(`<img src="cid:${cart.items[1].image}"`);
            expect(html).toContain(cart.items[1].name);
            expect(html).toContain(cart.items[1].formattedPrice);
     
            expect(html).toContain(`Total: ${cart.formattedTotal} ${process.env.CURRENCY}`);
    
            // ___ ETH was sent to ___ 
            expect(html).toContain(`${cart.formattedTotal} ${process.env.CURRENCY}`);
            expect(html).toContain(`${process.env.WALLET}`);

            // Shipping details
            expect(html).toContain('Shipping details:');
            expect(html).toContain(_order.recipient);
            expect(html).toContain(_order.street);
            expect(html).toContain(_order.city);
            expect(html).toContain(_order.province);
            expect(html).toContain(_order.postcode);
            expect(html).toContain('Customer declined email contact');

            // File attachments 
            const attachments = mailer.transport.sentMail[0].data.attachments;
            expect(attachments.length).toEqual(3);
            expect(attachments[0].filename).toEqual(cart.items[0].image);
            expect(attachments[0].path).toEqual(path.resolve(__dirname, '../../public/images/products', cart.items[0].image));
            expect(attachments[0].cid).toEqual(cart.items[0].image);
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

        describe('customer requests email confirmation', () => {
  
          beforeEach((done) => {
            browser.fill('email', _order.email).pressButton('Place Order', (err) => {
              if (err) done.fail(err);
              browser.assert.success();
              browser.assert.url('/cart/receipt');
              done();
            });
          });

          it('sends an email with correct header information to the vendor', () => {
            expect(mailer.transport.sentMail.length).toEqual(2);
            expect(mailer.transport.sentMail[0].data.to).toEqual(process.env.FROM);
            expect(mailer.transport.sentMail[0].data.from).toEqual(_order.email);
            expect(mailer.transport.sentMail[0].data.subject).toEqual('New order received');
          });

          it('sends an email with text content to the vendor', () => {
            const text = mailer.transport.sentMail[0].data.text;
            expect(text).toContain(
              `1. ${cart.items[0].name} - ${cart.items[0].option}, ${cart.items[0].formattedPrice}`);
            expect(text).toContain(`2. ${cart.items[1].name}, ${cart.items[1].formattedPrice}`);
            expect(text).toContain(`TOTAL: ${cart.formattedTotal} ${process.env.CURRENCY}`);
    
            expect(text).toContain(`${cart.formattedTotal} ${process.env.CURRENCY} was sent to ${process.env.WALLET}`);
            expect(text).toContain(`Transaction ID: ${_order.transaction}`);

            expect(text).toContain('Shipping details:');
            expect(text).toContain(_order.recipient);
            expect(text).toContain(_order.street);
            expect(text).toContain(_order.city);
            expect(text).toContain(_order.province);
            expect(text).toContain(_order.postcode);
            expect(text).toContain(_order.email);
          });
    
          it('sends an email with html content to the vendor', (done) => {
            const html = mailer.transport.sentMail[0].data.html;
            expect(html).toContain(`<img src="cid:${cart.items[0].image}"`);
            expect(html).toContain(cart.items[0].name);
            expect(html).toContain(`- ${cart.items[0].option}`);
            expect(html).toContain(cart.items[0].formattedPrice);
    
            expect(html).toContain(`<img src="cid:${cart.items[1].image}"`);
            expect(html).toContain(cart.items[1].name);
            expect(html).toContain(cart.items[1].formattedPrice);
     
            expect(html).toContain(`Total: ${cart.formattedTotal} ${process.env.CURRENCY}`);
    
            // ___ ETH was sent to ___ 
            expect(html).toContain(`${cart.formattedTotal} ${process.env.CURRENCY}`);
            expect(html).toContain(`${process.env.WALLET}`);

            // Shipping details
            expect(html).toContain('Shipping details:');
            expect(html).toContain(_order.recipient);
            expect(html).toContain(_order.street);
            expect(html).toContain(_order.city);
            expect(html).toContain(_order.province);
            expect(html).toContain(_order.postcode);
            expect(html).toContain(_order.email);

            // File attachments 
            const attachments = mailer.transport.sentMail[0].data.attachments;
            expect(attachments.length).toEqual(3);
            expect(attachments[0].filename).toEqual(cart.items[0].image);
            expect(attachments[0].path).toEqual(path.resolve(__dirname, '../../public/images/products', cart.items[0].image));
            expect(attachments[0].cid).toEqual(cart.items[0].image);
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
      });

      describe('customer experience', () => {

        describe('customer does not request email confirmation', () => {
          beforeEach((done) => {
            browser.uncheck('contact');
            browser.fill('email', '').pressButton('Place Order', () => {
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
            browser.assert.element(`tr:nth-child(1) td.product-thumb img[src="/images/products/${products[0].image}"]`);
            browser.assert.text('tr:nth-child(1) td:nth-child(2)', `${products[0].name} - ${products[0].options[0]}`);
            browser.assert.text('tr:nth-child(1) td:nth-child(3)', products[0].formattedPrice);
      
            browser.assert.element(`tr:nth-child(2) td.product-thumb img[src="/images/products/${products[1].image}"]`);
            browser.assert.text('tr:nth-child(2) td:nth-child(2)', products[1].name);
            browser.assert.text('tr:nth-child(2) td:nth-child(3)', products[1].formattedPrice);
      
            browser.assert.text('tr.info',
                `${Number(Units.convert(products[0].price * 2, 'gwei', 'eth'))} ${process.env.CURRENCY}`);
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
              expect(results[0].session.cart.totals).toEqual(0);
              expect(results[0].session.cart.formattedTotal).toEqual(0);
    
              done();
            });
          });
        });
  
        describe('customer requests email confirmation', () => {
  
          beforeEach(() => {
            browser.check('contact');
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
              browser.assert.url('/cart/receipt');
              browser.assert.text('.alert-success', `Your order has been received. An email copy of this receipt will be sent to ${_order.email}`);
            });

            it('displays the products ordered', () => {
              browser.assert.elements('tr', 3);
              browser.assert.element(`tr:nth-child(1) td.product-thumb img[src="/images/products/${products[0].image}"]`);
              browser.assert.text('tr:nth-child(1) td:nth-child(2)', `${products[0].name} - ${products[0].options[0]}`);
              browser.assert.text('tr:nth-child(1) td:nth-child(3)', products[0].formattedPrice);

              browser.assert.element(`tr:nth-child(2) td.product-thumb img[src="/images/products/${products[1].image}"]`);
              browser.assert.text('tr:nth-child(2) td:nth-child(2)', products[1].name);
              browser.assert.text('tr:nth-child(2) td:nth-child(3)', products[1].formattedPrice);
        
              browser.assert.text('tr.info',
                  `${Number(Units.convert(products[0].price * 2, 'gwei', 'eth'))} ${process.env.CURRENCY}`);
            });
  
            // Super flaky
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
              browser.assert.text('.shipping-info section .country', _order.country);
              browser.assert.text('.shipping-info section .postcode', _order.postcode);
              browser.assert.text('.shipping-info section .email', _order.email);
              browser.assert.text('.shipping-info footer div:nth-child(1)', `Send questions to ${process.env.FROM}`);
              browser.assert.text('.shipping-info footer div:nth-child(2)', 'Keep this order for your records.');
            });

            it('sends an email with correct header information to the buyer', () => {
              expect(mailer.transport.sentMail.length).toEqual(2);
              expect(mailer.transport.sentMail[1].data.to).toEqual(_order.email);
              expect(mailer.transport.sentMail[1].data.from).toEqual(process.env.FROM);
              expect(mailer.transport.sentMail[1].data.subject).toEqual('Order received - here is your receipt');
            });
      
            it('sends an email with text content to the buyer', () => {
              const text = mailer.transport.sentMail[1].data.text;
              expect(text).toContain('Thank you!');
              expect(text).toContain(
                `1. ${cart.items[0].name} - ${cart.items[0].option}, ${cart.items[0].formattedPrice}`);
              expect(text).toContain(`2. ${cart.items[1].name}, ${cart.items[1].formattedPrice}`);
              expect(text).toContain(`TOTAL: ${cart.formattedTotal} ${process.env.CURRENCY}`);
      
              expect(text).toContain(`You sent ${cart.formattedTotal} ${process.env.CURRENCY} to ${process.env.WALLET}`);
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
              expect(html).toContain(cart.items[0].formattedPrice);
      
              expect(html).toContain(`<img src="cid:${cart.items[1].image}"`);
              expect(html).toContain(cart.items[1].name);
              expect(html).toContain(cart.items[1].formattedPrice);
       
              expect(html).toContain(`Total: ${cart.formattedTotal} ${process.env.CURRENCY}`);
      
              // You sent ___ ETH to ___ 
              expect(html).toContain(`${cart.formattedTotal} ${process.env.CURRENCY}`);
              expect(html).toContain(`${process.env.WALLET}`);

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
                  
                          browser.fill('transaction', _order.transaction);
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
              expect(html).toContain(cart.items[0].formattedPrice);

              expect(html).toContain(`<img src="cid:${cart.items[1].image}"`);
              expect(html).toContain(cart.items[1].name);
              expect(html).toContain(cart.items[1].formattedPrice);

              expect(html).toContain(`Total: ${cart.formattedTotal} ${process.env.CURRENCY}`);

              // You sent ___ ETH to ___
              expect(html).toContain(`${cart.formattedTotal} ${process.env.CURRENCY}`);
              expect(html).toContain(`${process.env.WALLET}`);

              // Shipping details
              expect(html).toContain('Once your transaction has been verified, your order will be processed and shipped to:');
              expect(html).toContain(_order.recipient);
              expect(html).toContain(_order.street);
              expect(html).toContain(_order.city);
              expect(html).toContain(_order.province);
              expect(html).toContain(_order.postcode);
              expect(html).toContain('Reply to this email with questions');

              // Attachments
              const attachments = mailer.transport.sentMail[0].data.attachments;
              expect(attachments.length).toEqual(3);
              expect(attachments[0].filename).toEqual(cart.items[0].image);
              expect(attachments[0].path).toEqual(path.resolve(__dirname, '../../public/images/products', cart.items[0].image));
              expect(attachments[0].cid).toEqual(cart.items[0].image);
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
        });
      });
    });
  });
});
