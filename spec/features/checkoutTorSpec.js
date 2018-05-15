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
    process.env.TOR = true;
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
      process.env.TOR = '';
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

      describe('vendor experience', () => {

        describe('customer request no email contact', () => {

          beforeEach((done) => {
            browser.uncheck('contact');
            browser.fill('transaction', _order.transaction);
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
        });

        describe('customer requests email transaction', () => {

          beforeEach((done) => {
            browser.fill('email', _order.email).pressButton('Place Order', (err) => {
              if (err) done.fail(err);
              browser.assert.success();
              browser.assert.url('/');
              done();
            });
          });

          it('sends an email with correct header information to the vendor', () => {
            expect(mailer.transport.sentMail.length).toEqual(2);
            expect(mailer.transport.sentMail[0].data.to).toEqual(process.env.FROM);
            expect(mailer.transport.sentMail[0].data.from).toEqual(_order.email);
            expect(mailer.transport.sentMail[0].data.subject).toEqual('New order received - unpaid');
          });

          it('sends customer email with correct header information to the vendor', () => {
            expect(mailer.transport.sentMail.length).toEqual(2);
            expect(mailer.transport.sentMail[1].data.to).toEqual(process.env.FROM);
            expect(mailer.transport.sentMail[1].data.from).toEqual(_order.email);
            expect(mailer.transport.sentMail[1].data.subject).toEqual('Order received - payment instructions');
          });
        });

        describe('customer requests no email transaction but provides email', () => {
          beforeEach((done) => {
            browser.uncheck('contact').fill('transaction', _order.transaction).fill('email', _order.email).pressButton('Place Order', (err) => {
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

          it('sends customer email with correct header information to the vendor', () => {
            expect(mailer.transport.sentMail.length).toEqual(2);
            expect(mailer.transport.sentMail[1].data.to).toEqual(process.env.FROM);
            expect(mailer.transport.sentMail[1].data.from).toEqual(_order.email);
            expect(mailer.transport.sentMail[1].data.subject).toEqual('Order received - here is your receipt');
          });
        });
      });
    });
  });
});
