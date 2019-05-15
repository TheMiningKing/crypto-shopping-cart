'use strict';                  

const app = require('../../app'); 
const models = require('../../models');
const mailer = require('../../mailer');
const fixtures = require('pow-mongoose-fixtures');

const Browser = require('zombie');
const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001; 
Browser.localhost('example.com', PORT);

describe('checkout', () => {

  let browser, products;
  beforeEach((done) => {
    browser = new Browser({ waitDuration: '30s', loadCss: false });

    fixtures.load(__dirname + '/../fixtures/wallets.js', models.mongoose, (err) => {
      if (err) done.fail(err);

      fixtures.load(__dirname + '/../fixtures/products.js', models.mongoose, (err) => {
        if (err) done.fail(err);
  
        models.Product.find({}).sort('createdAt').then((results) => {
          products = results;
          done();
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
      browser.visit('/product', (err) => {
        if (err) done.fail(err);

        browser.pressButton('li.product:nth-child(1) form button[type=submit]', () => {

          browser.visit('/product', (err) => {
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
        browser.fill('recipient', _order.recipient);
        browser.fill('street', _order.street);
        browser.fill('city', _order.city);
        browser.fill('province', _order.province);
        browser.fill('country', _order.country);
        browser.fill('postcode', _order.postcode);
        browser.check('contact');
        browser.fill('email', _order.email);
      });

      it('reports an error if recipient is omitted', (done) => {
        browser.fill('recipient', '  ');
        browser.pressButton('Place Order', () => {
          browser.assert.url('/cart/checkout');
          browser.assert.text('.alert-danger', 'You must provide a recipient');
          expect(mailer.transport.sentMail.length).toEqual(0);
          done();
        });
      });

      it('reports an error if street is omitted', (done) => {
        browser.fill('street', '  ');
        browser.pressButton('Place Order', () => {
          browser.assert.url('/cart/checkout');
          browser.assert.text('.alert-danger', 'You must provide a street');
          expect(mailer.transport.sentMail.length).toEqual(0);
          done();
        });
      });

      it('reports an error if city is omitted', (done) => {
        browser.fill('city', '  ');
        browser.pressButton('Place Order', () => {
          browser.assert.url('/cart/checkout');
          browser.assert.text('.alert-danger', 'You must provide a city');
          expect(mailer.transport.sentMail.length).toEqual(0);
          done();
        });
      });

      it('reports an error if province is omitted', (done) => {
        browser.fill('province', '  ');
        browser.pressButton('Place Order', () => {
          browser.assert.url('/cart/checkout');
          browser.assert.text('.alert-danger', 'You must provide a province');
          expect(mailer.transport.sentMail.length).toEqual(0);
          done();
        });
      });

      it('reports an error if country is omitted', (done) => {
        browser.fill('country', '  ');
        browser.pressButton('Place Order', () => {
          browser.assert.url('/cart/checkout');
          browser.assert.text('.alert-danger', 'You must provide a country');
          expect(mailer.transport.sentMail.length).toEqual(0);
          done();
        });
      });

      it('reports an error if postal code is omitted', (done) => {
        browser.fill('postcode', '  ');
        browser.pressButton('Place Order', () => {
          browser.assert.url('/cart/checkout');
          browser.assert.text('.alert-danger', 'You must provide a postal code');
          expect(mailer.transport.sentMail.length).toEqual(0);
          done();
        });
      });

      it('reports an error if email confirmation is requested but omitted', (done) => {
        browser.check('contact');
        browser.fill('email', '   ');
        browser.pressButton('Place Order', () => {
          browser.assert.url('/cart/checkout');
          browser.assert.text('.alert-danger', 'You requested email confirmation. You must provide an email.');
          expect(mailer.transport.sentMail.length).toEqual(0);
          done();
        });
      });

      it('chains omitted fields', (done) => {
        browser.fill('postcode', '  ');
        browser.fill('country', '  ');
        browser.fill('email', '');
        browser.pressButton('Place Order', () => {
          browser.assert.url('/cart/checkout');
          browser.assert.text('.messages .alert:nth-child(1).alert-danger',
                              'You must provide a country, postal code');
          browser.assert.text('.messages .alert:nth-child(2).alert-danger',
                              'You requested email confirmation. You must provide an email.');
          expect(mailer.transport.sentMail.length).toEqual(0);
          done();
        });
      });

      it('repopulates correctly-entered fields', (done) => {
        browser.fill('transaction', '  ');
        browser.fill('country', '  ');
        browser.fill('email', '');
        browser.pressButton('Place Order', () => {
          browser.assert.url('/cart/checkout');
          browser.assert.input('#transaction', '  ');
          browser.assert.input('#recipient', _order.recipient);
          browser.assert.input('#street', _order.street);
          browser.assert.input('#city', _order.city);
          browser.assert.input('#province', _order.province);
          browser.assert.input('#country', '  ');
          browser.assert.input('#postcode', _order.postcode);
          browser.assert.input('#email', '');
          expect(mailer.transport.sentMail.length).toEqual(0);
          done();
        });
      });

      describe('email confirmation declined', () => {
        it('reports an error if transaction ID is not provided', (done) => {
          browser.uncheck('contact');
          browser.fill('email', '  ');
          browser.fill('transaction', '  ');
          browser.pressButton('Place Order', () => {
            browser.assert.url('/cart/checkout');
            browser.assert.text('.alert-danger',
                                'You must provide a transaction ID if not completing order via email');
            expect(mailer.transport.sentMail.length).toEqual(0);
            done();
          });
        });

        it('does not report an error if transaction ID is provided', (done) => {
          browser.uncheck('contact');
          browser.fill('email', '  ');
          browser.fill('transaction', _order.transaction);
          browser.pressButton('Place Order', () => {
            browser.assert.url('/cart/receipt');
            browser.assert.text('.alert-success',
                                'Your order has been received. Print this receipt for your records.');
            expect(mailer.transport.sentMail.length).toEqual(1);
            done();
          });
        });

        it('does not report an error if transaction ID and email are provided', (done) => {
          browser.uncheck('contact');
          browser.fill('email', _order.email);
          browser.fill('transaction', _order.transaction);
          browser.pressButton('Place Order', () => {
            browser.assert.url('/cart/receipt');
            browser.assert.text('.alert-success', `Your order has been received. An email copy of this receipt will be sent to ${_order.email}`);
            expect(mailer.transport.sentMail.length).toEqual(2);
            done();
          });
        });
      });
    });
  });
});
