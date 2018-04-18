'use strict';                  

const app = require('../../app'); 
const models = require('../../models');
const fixtures = require('pow-mongoose-fixtures');

const Browser = require('zombie');
const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001; 
Browser.localhost('example.com', PORT);

describe('categories', () => {

  let browser, _products;
  beforeEach((done) => {
    browser = new Browser({ waitDuration: '30s', loadCss: false });

    fixtures.load(__dirname + '/../fixtures/products.js', models.mongoose, (err) => {
      if (err) done.fail(err);

      models.Product.find({}).sort('createdAt').then((results) => {
        _products = results;
        done();
      });
    });
  });

  afterEach((done) => {
    models.dropDatabase(() => {
      done();
    });
  });

  it('adds a session containing an empty cart on first visit', (done) => {
    models.collection('sessions').find({}).toArray((err, results) => {
      if (err) {
        done.fail(err);
      }
      expect(results.length).toEqual(0);
      browser.visit('/category/dummy', (err) => {
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

  describe('when no such category exists', () => {
    beforeEach((done) => {
      browser.visit('/category/nosuchcategory', (err) => {
        if (err) done.fail(err);
        browser.assert.success();
        browser.assert.url('/category/nosuchcategory');
          done();
      });
    });

    it('displays an appropriate message', () => {
      browser.assert.text('.alert-info', 'No such category exists: nosuchcategory');
    });

    it('displays a Continue Shopping button linking to root', () => {
      browser.assert.elements('i.fa.fa-backward.go-to-shop-lnk', 1);
      browser.assert.link('.navbar-brand', 'See all products', '/');
    });
  });

  describe('when category exists', () => {
    beforeEach((done) => {
      browser.visit('/category/mens', (err) => {
        if (err) {
          done.fail(err);
        } 
        browser.assert.success();
        done();
      });
    });

    it('displays only the products in that category', (done) => {
      models.Product.find({ categories: 'mens' }).sort('createdAt').then((results) => {
        expect(results.length).toEqual(1);
        expect(results[0].categories.length).toEqual(1);
        expect(results[0].categories[0]).toEqual('mens');

        browser.assert.elements('ul#products li.product', results.length);

        // Man's t-shirt
        browser.assert.text('ul#products li.product:nth-child(1) h3.product-title', results[0].name);
        browser.assert.element(`ul#products li.product figure.product-image img[src="/images/products/${results[0].image}"]`);
        browser.assert.text('ul#products li.product:nth-child(1) .product-description', results[0].description);
        browser.assert.text('ul#products li.product:nth-child(1) .cart-data .product-info span.price', `${results[0].formattedPrice}`);
        browser.assert.text(`ul#products li.product:nth-child(1) .cart-data form input[type=hidden][name=id][value="${results[0].id}"]`);

        done();
      });
    });

    it('displays a Checkout link', (done) => {
      browser.clickLink('Checkout', (err) => {
        if (err) done.fail(err);
        browser.assert.success();
        browser.assert.url('/cart');
        done();
      });
    });

    it('displays a Main Shop link', (done) => {
      browser.clickLink('See all products', (err) => {
        if (err) done.fail(err);
        browser.assert.success();
        browser.assert.url('/');
        done();
      });
    });

    describe('contextual checkout behaviour', () => {
      it('displays a Continue Shopping button linking category path', (done) => {
        browser.clickLink('Checkout', (err) => {
          if (err) done.fail(err);
          browser.assert.success();
          browser.assert.elements('i.fa.fa-shopping-cart.go-to-shop-lnk', 1);
          browser.assert.link('.navbar-brand', 'Continue shopping', '/category/mens');
          done();
        });
      });
    });
  });
});
