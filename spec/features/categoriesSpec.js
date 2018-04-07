'use strict';                  

const app = require('../../app'); 
const models = require('../../models');
//const mailer = require('../../mailer');
const fixtures = require('pow-mongoose-fixtures');
//const path = require('path');

const Browser = require('zombie');
const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001; 
Browser.localhost('example.com', PORT);

describe('categories', () => {

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

  it('displays a Continue Shopping button', (done) => {
    browser.visit('/category/dummy', (err) => {
      if (err) {
        done.fail(err);
      }
      browser.assert.elements('i.fa.fa-shopping-cart.go-to-shop-lnk', 1);
      browser.assert.link('.navbar-brand', 'Continue shopping', '/');
      done();
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
  });

  describe('when category exists', () => {
  });

});
