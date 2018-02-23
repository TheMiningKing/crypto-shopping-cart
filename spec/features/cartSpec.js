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

describe('cart', () => {

  let browser;

  afterEach((done) => {
    models.dropDatabase(() => {
      done();
    });
  });

  describe('when cart is empty', () => {
    beforeEach((done) => {
      browser = new Browser({ waitDuration: '30s', loadCss: false });

      browser.visit('/', (err) => {
        if (err) done.fail(err);
        browser.clickLink('Checkout', (err) => {
          if (err) done.fail(err);
          browser.assert.success();
          done();
        });
      });
    });

    it('displays a no-products-in-cart message', () => {
      browser.assert.text('p.alert.alert-info', 'Your cart is empty');
    });

    it('displays a continue-shopping message', () => {
      browser.assert.link('.navbar-header a.navbar-brand', 'Continue shopping', '/');
      browser.assert.elements('i.fa.fa-shopping-cart.go-to-cart-lnk', 0);
    });

    it('does not display an order form', () => {
      browser.assert.elements('form', 0);
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

    it('displays the products in the cart', () => {
      browser.assert.elements('tr', 3);

      browser.assert.element(`tr:nth-child(1) td a[href="/cart/remove/${products[0].id}/${products[0].options[0]}"]`);
      browser.assert.element(`tr:nth-child(1) td.product-thumb img[src="/images/products/${products[0].image}"]`);
      browser.assert.text('tr:nth-child(1) td:nth-child(3)', `${products[0].name} - ${products[0].options[0]}`);
      browser.assert.text('tr:nth-child(1) td:nth-child(4)', products[0].formattedPrice);

      browser.assert.element(`tr:nth-child(2) td a[href="/cart/remove/${products[1].id}"]`);
      browser.assert.element(`tr:nth-child(2) td.product-thumb img[src="/images/products/${products[1].image}"]`);
      browser.assert.text('tr:nth-child(2) td:nth-child(3)', products[1].name);
      browser.assert.text('tr:nth-child(2) td:nth-child(4)', products[1].formattedPrice);

      browser.assert.text('tr.info',
          `${Number(Units.convert(products[0].price * 2, 'gwei', 'eth'))} ${process.env.CURRENCY}`);
    });

    it('displays product variants in the cart', (done) => {
      browser.visit('/', (err) => {
        if (err) done.fail(err);

        browser
        .select('li.product:nth-child(1) form select', products[0].options[2])
        .pressButton('li.product:nth-child(1) form button[type=submit]', () => {
          browser.assert.redirected();
          browser.assert.url('/cart');
 
          browser.assert.elements('tr', 4);
    
          browser.assert.text('tr:nth-child(1) td:nth-child(3)', `${products[0].name} - ${products[0].options[0]}`);
          browser.assert.text('tr:nth-child(2) td:nth-child(3)', products[1].name);
          browser.assert.text('tr:nth-child(3) td:nth-child(3)', `${products[0].name} - ${products[0].options[2]}`);

          done();
        });
      });
    });

    it('displays an order submission form', () => {
      browser.assert.element('form.form-horizontal[action="/cart/checkout"]');
      browser.assert.element('form.form-horizontal input[type="email"][name="email"]');
      browser.assert.element('form.form-horizontal button[type="submit"]');
    });

    describe('removing item from cart', () => {

      it('removes the item from the session cart', (done) => {
        models.collection('sessions').find({}).toArray((err, results) => {
          if (err) {
            done.fail(err);
          }
          expect(results.length).toEqual(1);
          expect(results[0].session.cart.items.length).toEqual(2);
          expect(results[0].session.cart.totals).toEqual(products[0].price * 2);

          browser.clickLink(`tr:nth-child(2) td a[href="/cart/remove/${products[1].id}"]`, () => {
            models.collection('sessions').find({}).toArray((err, results) => {
              if (err) {
                done.fail(err);
              }
              expect(results.length).toEqual(1);
              expect(results[0].session.cart.items.length).toEqual(1);
              expect(results[0].session.cart.totals).toEqual(products[0].price);
              expect(results[0].session.cart.items[0].name).toEqual(products[0].name);

              done();
            });
          });
        });
      });

      it('removes the item from the display', (done) => {
        browser.assert.elements('tr', 3);
        browser.assert.element(`tr:nth-child(2) td.product-thumb img[src="/images/products/${products[1].image}"]`);

        browser.clickLink(`tr:nth-child(2) td a[href="/cart/remove/${products[1].id}"]`, () => {
          browser.assert.elements('tr', 2);
          browser.assert.elements(`tr:nth-child(2) td.product-thumb img[src="/images/products/${products[1].image}"]`, 0);
          done();
        });
      });

      it('removes correct product variant from the cart', (done) => {
        browser.assert.elements('tr', 3);
        browser.visit('/', (err) => {
          if (err) done.fail(err);
  
          browser
            .select('li.product:nth-child(1) form select', products[0].options[2])
            .pressButton('li.product:nth-child(1) form button[type=submit]', () => {
              browser.assert.redirected();
              browser.assert.url('/cart');
     
              browser.assert.elements('tr', 4);
        
              browser.assert.text('tr:nth-child(1) td:nth-child(3)', `${products[0].name} - ${products[0].options[0]}`);
              browser.assert.text('tr:nth-child(2) td:nth-child(3)', products[1].name);
              browser.assert.text('tr:nth-child(3) td:nth-child(3)', `${products[0].name} - ${products[0].options[2]}`);
    
              browser.clickLink(`tr:nth-child(3) td a[href="/cart/remove/${products[0].id}/${products[0].options[2]}"]`, () => {
                browser.assert.elements('tr', 3);
                browser.assert.text('tr:nth-child(1) td:nth-child(3)', `${products[0].name} - ${products[0].options[0]}`);
                browser.assert.text('tr:nth-child(2) td:nth-child(3)', products[1].name);
 
                done();
              });
            });
        });
      });
    });

    describe('checkout', () => {
      let cart;

      describe('all products are distinct', () => {
        beforeEach((done) => {
          browser.assert.url('/cart');
  
          models.collection('sessions').findOne({}, (err, result) => {
            if (err) {
              done.fail(err);
            }
            cart = result.session.cart;
            expect(cart.items.length).toEqual(2);
   
            browser.fill('email', 'dan@example.com').pressButton('Place Order', () => {
              browser.assert.success();  
              done();
            });
          });
        });
  
        afterEach((done) => {
          mailer.transport.sentMail = [];
          done();
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
  
        afterEach((done) => {
          mailer.transport.sentMail = [];
          done();
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
