'use strict';                  

const app = require('../../app'); 
const models = require('../../models');
const fixtures = require('pow-mongoose-fixtures');
const Units = require('ethereumjs-units');

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

      browser.visit('/cart', (err) => {
        if (err) done.fail(err);
        browser.assert.success();
        done();
      });
    });

    it('displays a no-products-in-cart message', () => {
      browser.assert.text('p.alert.alert-info', 'Your cart is empty');
    });

    it('displays a continue-shopping message', () => {
      browser.assert.link('.navbar-header a.navbar-brand', 'Continue shopping', '/');
      browser.assert.elements('i.fa.fa-shopping-cart.go-to-cart-lnk', 0);
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

            browser.pressButton('li.product:nth-child(1) form div button[type=submit]', () => {

              browser.visit('/', (err) => {
                if (err) done.fail(err);

                browser.pressButton('li.product:nth-child(2) form div button[type=submit]', () => {
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

      browser.assert.element(`tr:nth-child(1) td a[href="/cart/remove/${products[0].id}"]`);
      browser.assert.element(`tr:nth-child(1) td.product-thumb img[src="/images/products/${products[0].image}"]`);
      browser.assert.text('tr:nth-child(1) td:nth-child(3)', `${products[0].name} - ${products[0].options[0]}`);
      browser.assert.text('tr:nth-child(1) td:nth-child(4)', products[0].formattedPrice);
      browser.assert.element(`tr:nth-child(1) td:nth-child(5) input[type=hidden][value="${products[0].id}"]`);

      browser.assert.element(`tr:nth-child(2) td a[href="/cart/remove/${products[1].id}"]`);
      browser.assert.element(`tr:nth-child(2) td.product-thumb img[src="/images/products/${products[1].image}"]`);
      browser.assert.text('tr:nth-child(2) td:nth-child(3)', products[1].name);
      browser.assert.text('tr:nth-child(2) td:nth-child(4)', products[1].formattedPrice);
      browser.assert.element(`tr:nth-child(2) td:nth-child(5) input[type=hidden][value="${products[1].id}"]`);

      browser.assert.text('tr.info', `Total: ${Number(Units.convert(products[0].price * 2, 'gwei', 'eth'))}`);
    });

    it('displays product variants in the cart', (done) => {
      browser.visit('/', (err) => {
        if (err) done.fail(err);

        browser
        .select('li.product:nth-child(1) form div select', products[0].options[2])
        .pressButton('li.product:nth-child(1) form div button[type=submit]', () => {
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
    });
  });
});
