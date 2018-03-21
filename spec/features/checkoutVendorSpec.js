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
            expect(text).toContain(_order.country);
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

            // TransactionID
            expect(html).toContain(_order.transaction);

            // Shipping details
            expect(html).toContain('Shipping details:');
            expect(html).toContain(_order.recipient);
            expect(html).toContain(_order.street);
            expect(html).toContain(_order.city);
            expect(html).toContain(_order.province);
            expect(html).toContain(_order.postcode);
            expect(html).toContain(_order.country);
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

          it('sends an email with correct header information to the customer', () => {
            expect(mailer.transport.sentMail.length).toEqual(2);
            expect(mailer.transport.sentMail[1].data.to).toEqual(_order.email);
            expect(mailer.transport.sentMail[1].data.from).toEqual(process.env.FROM);
            expect(mailer.transport.sentMail[1].data.subject).toEqual('Order received - payment instructions');
          });

          it('sends an email with text content to the vendor', () => {
            const text = mailer.transport.sentMail[0].data.text;
            expect(text).toContain(
              `1. ${cart.items[0].name} - ${cart.items[0].option}, ${cart.items[0].formattedPrice}`);
            expect(text).toContain(`2. ${cart.items[1].name}, ${cart.items[1].formattedPrice}`);
            expect(text).toContain(`TOTAL: ${cart.formattedTotal} ${process.env.CURRENCY}`);
    
            expect(text).toContain(`The customer was instructed to send ${cart.formattedTotal} ${process.env.CURRENCY} to ${process.env.WALLET}`);

            expect(text).toContain('Shipping details:');
            expect(text).toContain(_order.recipient);
            expect(text).toContain(_order.street);
            expect(text).toContain(_order.city);
            expect(text).toContain(_order.province);
            expect(text).toContain(_order.postcode);
            expect(text).toContain(_order.country);
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
    
            // The customer was instructed to send ___ ETH to ___ 
            expect(html).toContain(`${cart.formattedTotal} ${process.env.CURRENCY}`);
            expect(html).toContain(`${process.env.WALLET}`);

            // TransactionID
            expect(html).not.toContain(_order.transaction);

            // Shipping details
            expect(html).toContain('Shipping details:');
            expect(html).toContain(_order.recipient);
            expect(html).toContain(_order.street);
            expect(html).toContain(_order.city);
            expect(html).toContain(_order.province);
            expect(html).toContain(_order.postcode);
            expect(html).toContain(_order.country);
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
    
            done();
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

          it('sends an email with correct header information to the customer', () => {
            expect(mailer.transport.sentMail.length).toEqual(2);
            expect(mailer.transport.sentMail[1].data.to).toEqual(_order.email);
            expect(mailer.transport.sentMail[1].data.from).toEqual(process.env.FROM);
            expect(mailer.transport.sentMail[1].data.subject).toEqual('Order received - here is your receipt');
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
            expect(text).toContain(_order.country);
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

            // TransactionID
            expect(html).toContain(_order.transaction);

            // Shipping details
            expect(html).toContain('Shipping details:');
            expect(html).toContain(_order.recipient);
            expect(html).toContain(_order.street);
            expect(html).toContain(_order.city);
            expect(html).toContain(_order.province);
            expect(html).toContain(_order.postcode);
            expect(html).toContain(_order.country);
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
    });
  });
});
