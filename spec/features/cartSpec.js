'use strict';                  

const app = require('../../app'); 
const models = require('../../models');
const fixtures = require('pow-mongoose-fixtures');

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
  });
});
