'use strict';                  

const app = require('../../app'); 
const models = require('../../models');
const fixtures = require('pow-mongoose-fixtures');

const Browser = require('zombie');
const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001; 
Browser.localhost('example.com', PORT);

describe('index', () => {

  let browser;

  it('adds a session on first visit', (done) => {
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
      browser.assert.text('p.alert.alert-info', 'Sorry, no products to show.');
    });
  });

  describe('when database contains products', () => {
    beforeEach((done) => {
      browser = new Browser({ waitDuration: '30s', loadCss: false });

      fixtures.load(__dirname + '/../fixtures/products.js', models.mongoose, (err) => {
        browser.visit('/', (err) => {
          if (err) done.fail(err);
          browser.assert.success();
          done();
        });
      });
    });

    afterEach((done) => {
      models.dropDatabase(() => {
        done();
      });
    });

    it('does not display empty DB messge', () => {
      browser.assert.elements('p.alert.alert-info', 0);
    });

    it('structures the product list with what\'s in the database', (done) => {
      models.Product.find({}).then((results) => {
        expect(results.length).toEqual(2);

        browser.assert.elements('ul#products li.product', results.length);

        // First product
        browser.assert.text('ul#products li.product:nth-child(1) h3.product-title', results[0].name);
        browser.assert.element(`ul#products li.product figure.product-image img[src="/images/products/${results[0].image}"]`);
        browser.assert.text('ul#products li.product:nth-child(1) .cart-data form div span.price', results[0].price);
        browser.assert.text(`ul#products li.product:nth-child(1) .cart-data form div input[value="${results[0].id}"]`);

        // Second product
        browser.assert.text('ul#products li.product:nth-child(2) h3.product-title', results[1].name);
        browser.assert.element(`ul#products li.product figure.product-image img[src="/images/products/${results[1].image}"]`);
        browser.assert.text('ul#products li.product:nth-child(2) .cart-data form div span.price', results[1].price);
        browser.assert.text(`ul#products li.product:nth-child(2) .cart-data form div input[value="${results[1].id}"]`);
 
        done();
      }).catch((error) => {
        done.fail(error);
      });
    });

    describe('adding item to cart', () => {

    });
  });
});

