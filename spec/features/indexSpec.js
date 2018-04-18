'use strict';                  

const app = require('../../app'); 
const models = require('../../models');
const fixtures = require('pow-mongoose-fixtures');

const Browser = require('zombie');
const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001; 
Browser.localhost('example.com', PORT);

describe('index', () => {

  let browser;

  afterEach((done) => {
    models.dropDatabase(() => {
      done();
    });
  });

  it('adds a session containing an empty cart on first visit', (done) => {
    browser = new Browser({ waitDuration: '30s', loadCss: false });

    models.collection('sessions').find({}).toArray((err, results) => {
      if (err) {
        done.fail(err);
      }
      expect(results.length).toEqual(0);
      browser.visit('/', (err) => {
        if (err) {
          done.fail(err);
        }
        models.collection('sessions').find({}).toArray((err, results) => {
          if (err) {
            done.fail(err);
          }
          expect(results.length).toEqual(1);
          expect(results[0]._id).not.toBe(undefined);
          expect(results[0].session).not.toBe(undefined);
          expect(results[0].session.cookie).not.toBe(undefined);
          expect(results[0].session.cart).not.toBe(undefined);
          expect(results[0].session.cart.items).toEqual([]);
          expect(results[0].session.cart.totals).toEqual(0);
          expect(results[0].expires).not.toBe(undefined);
          done();
        });
      });
    });
  });

  describe('when database is empty', () => {
    beforeEach((done) => {
      browser = new Browser({ waitDuration: '30s', loadCss: false });

      browser.visit('/', (err) => {
        if (err) done.fail(err);
        browser.assert.success();
        done();
      });
    });

    it('displays a no-products-in-db message', () => {
      browser.assert.text('.alert.alert-info', 'Sorry, no products to show.');
    });
  });

  describe('when database contains products', () => {
    beforeEach((done) => {
      browser = new Browser({ waitDuration: '30s', loadCss: false });

      fixtures.load(__dirname + '/../fixtures/products.js', models.mongoose, (err) => {
        if (err) done.fail(err);
        browser.visit('/', (err) => {
          if (err) done.fail(err);
          browser.assert.success();
          done();
        });
      });
    });

    it('does not display empty DB messge', () => {
      browser.assert.elements('p.alert.alert-info', 0);
    });

    it('displays a checkout button', () => {
      browser.assert.elements('.navbar-header a.navbar-brand[href="/"]', 0);
      browser.assert.elements('i.fa.fa-shopping-cart.go-to-cart-lnk', 1);
    });

    it('structures the product list with what\'s in the database', (done) => {
      models.Product.find({}).sort('createdAt').then((results) => {
        expect(results.length).toEqual(2);

        browser.assert.elements('ul#products li.product', results.length);

        // First product
        browser.assert.text('ul#products li.product:nth-child(1) h3.product-title', results[0].name);
        browser.assert.element(`ul#products li.product figure.product-image img[src="/images/products/${results[0].image}"]`);
        browser.assert.text('ul#products li.product:nth-child(1) .product-description', results[0].description);
        browser.assert.text('ul#products li.product:nth-child(1) .cart-data .product-info span.price',
                            `${results[0].formattedPrice} ${process.env.CURRENCY}`);
        browser.assert.text(`ul#products li.product:nth-child(1) .cart-data form input[type=hidden][name=id][value="${results[0].id}"]`);

        // Second product
        browser.assert.text('ul#products li.product:nth-child(2) .product-description', results[1].description);
        browser.assert.element(`ul#products li.product figure.product-image img[src="/images/products/${results[1].image}"]`);
        browser.assert.text('ul#products li.product:nth-child(2) .cart-data .product-info span.price',
                            `${results[1].formattedPrice} ${process.env.CURRENCY}`);
        browser.assert.text(`ul#products li.product:nth-child(2) .cart-data form input[type=hidden][name=id][value="${results[1].id}"]`);
 
        done();
      }).catch((error) => {
        done.fail(error);
      });
    });

    it('displays a select dropdown if a product has options', (done) => {
      models.Product.find({}).sort('createdAt').then((results) => {
        expect(results.length).toEqual(2);

        expect(results[0].options.length).toEqual(3);
        expect(results[1].options.length).toEqual(0);

        // First product
        browser.assert.text('ul#products li.product:nth-child(1) h3.product-title', results[0].name);
        browser.assert.element('ul#products li.product:nth-child(1) .cart-data form select');
        browser.assert.elements('ul#products li.product:nth-child(1) .cart-data form select option',
                                results[0].options.length);

        browser.assert.text(`ul#products li.product:nth-child(1) select option[value=${results[0].options[0]}]`,
                            results[0].options[0]);
        browser.assert.text(`ul#products li.product:nth-child(1) select option[value=${results[0].options[1]}]`,
                            results[0].options[1]);
        browser.assert.text(`ul#products li.product:nth-child(1) select option[value=${results[0].options[2]}]`,
                            results[0].options[2]);
 
        // Second product (no dropdown)
        browser.assert.text('ul#products li.product:nth-child(2) h3.product-title', results[1].name);
        browser.assert.elements('ul#products li.product:nth-child(2) .cart-data form select', 0);

        done();
      }).catch((error) => {
        done.fail(error);
      });
    });

    describe('adding item to cart', () => {
      let product;

      beforeEach((done) => {
        models.Product.findOne({}).then((results) => {
          product = results;
          done();
        });
      });

      it('adds an item to the cart session', (done) => {
        browser.pressButton('li.product:nth-child(1) form button[type=submit]', () => {

          models.collection('sessions').find({}).toArray((err, results) => {
            if (err) {
              done.fail(err);
            }
            expect(results.length).toEqual(1);
            expect(results[0].session.cart.items.length).toEqual(1);
            expect(results[0].session.cart.totals).toEqual(product.price);
            done();
          });
        });
      });

      it('redirects to cart', (done) => {
        browser.pressButton('li.product:nth-child(1) form button[type=submit]', () => {
          browser.assert.redirected();
          browser.assert.url('/cart');
          done();
        });
      });
    });
  });
});

