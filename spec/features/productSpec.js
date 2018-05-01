'use strict';                  

const app = require('../../app'); 
const models = require('../../models');
const fixtures = require('pow-mongoose-fixtures');

const Browser = require('zombie');
const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001; 
Browser.localhost('example.com', PORT);

describe('products', () => {

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
      browser.visit('/product/dummy', (err) => {
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

  describe('when no such product exists', () => {
    beforeEach((done) => {
      browser.visit('/product/no-such-product', (err) => {
        if (err) done.fail(err);
        browser.assert.success();
        browser.assert.url('/product/no-such-product');
        done();
      });
    });

    it('displays an appropriate message', () => {
      browser.assert.text('.messages .alert.alert-info', 'That product doesn\'t exist');
    });

    it('displays a Continue Shopping button linking to root', () => {
      browser.assert.elements('i.fa.fa-backward.go-to-shop-lnk', 1);
      browser.assert.link('.navbar-brand', 'See all products', '/');
    });
  });

  describe('when product exists', () => {
    beforeEach((done) => {
      browser.visit(`/product/${_products[0].friendlyLink}`, (err) => {
        if (err) {
          done.fail(err);
        } 
        browser.assert.success();
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

    it('displays the product matched to the friendly link', () => {
      let prod = _products[0];

      browser.assert.elements('ul#products li.product .thumb-viewer', 1);

      // Man's t-shirt
      browser.assert.text('ul#products li.product:nth-child(2) h3.product-title', prod.name);
      browser.assert.element(`ul#products li.product figure.product-image img[src="/images/products/${prod.images[0]}"]`);
      browser.assert.text('ul#products li.product:nth-child(3) .product-description', prod.description);
      browser.assert.text('ul#products li.product:nth-child(3) .cart-data .product-info span.price',
                          `${prod.formattedPrice} ${process.env.CURRENCY}`);
      browser.assert.text(`ul#products li.product:nth-child(3) .cart-data form input[type=hidden][name=id][value="${prod.id}"]`);
    });

    it('displays the product options if present', () => {
      let prod = _products[0];

      // Options
      browser.assert.element('ul#products li.product:nth-child(3) .cart-data form select');
      browser.assert.elements('ul#products li.product:nth-child(3) .cart-data form select option', prod.options.length);
      browser.assert.text(`ul#products li.product:nth-child(3) select option[value=${prod.options[0]}]`, prod.options[0]);
      browser.assert.text(`ul#products li.product:nth-child(3) select option[value=${prod.options[1]}]`, prod.options[1]);
      browser.assert.text(`ul#products li.product:nth-child(3) select option[value=${prod.options[2]}]`, prod.options[2]);
    });

    it('displays product thumbnail images if there is more than one', () => {
      let prod = _products[0];
      browser.assert.elements('input[type=radio]', prod.images.length);

      // Spacer image to account for absolute product positioning
      browser.assert.style('section.thumb-viewer figure.product-image', 'visibility', 'hidden');

      // Thumb 1
      browser.assert.style('input#thumb-0[type=radio]', 'content', `url('/images/products/${prod.images[0]}')`);
      browser.assert.element('input#thumb-0[type=radio][checked=checked]');
      browser.assert.text('head style', /input\[type="radio"\]#thumb-0:checked\+label {/);
      browser.assert.text('head style', new RegExp(`content: url\\('\\/images\\/products\\/${prod.images[0]}'\\);`));

      // Thumb 2
      browser.assert.style('input#thumb-1[type=radio]', 'content', `url('/images/products/${prod.images[1]}')`);
      browser.assert.elements('input#thumb-1[type=radio][checked=checked]', 0);
      browser.assert.text('head style', /input\[type="radio"\]#thumb-1:checked\+label {/);
      browser.assert.text('head style', new RegExp(`content: url\\('\\/images\\/products\\/${prod.images[1]}'\\);`));

      // Thumb 3
      browser.assert.style('input#thumb-2[type=radio]', 'content', `url('/images/products/${prod.images[2]}')`);
      browser.assert.elements('input#thumb-2[type=radio][checked=checked]', 0);
      browser.assert.text('head style', /input\[type="radio"\]#thumb-2:checked\+label {/);
      browser.assert.text('head style', new RegExp(`content: url\\('\\/images\\/products\\/${prod.images[2]}'\\);`));
    });

    it('does not display a select dropdown if product has no options', (done) => {
      let prod = _products[1];
      expect(prod.options.length).toEqual(0);

      browser.visit(`/product/${prod.friendlyLink}`, (err) => {
        if (err) {
          done.fail(err);
        } 
        browser.assert.success();

        // Woman's t-shirt (no options specified)
        browser.assert.text('ul#products li.product:nth-child(2) h3.product-title', prod.name);
        browser.assert.element(`ul#products li.product figure.product-image img[src="/images/products/${prod.images[0]}"]`);
        browser.assert.text('ul#products li.product:nth-child(3) .product-description', prod.description);
        browser.assert.text('ul#products li.product:nth-child(3) .cart-data .product-info span.price',
                            `${prod.formattedPrice} ${process.env.CURRENCY}`);
        browser.assert.text(`ul#products li.product:nth-child(3) .cart-data form input[type=hidden][name=id][value="${prod.id}"]`);

        browser.assert.elements('ul#products li.product:nth-child(3) .cart-data form select', 0);

        done();
      });
    });

    it('does not display product thumbnails if only one image specified', (done) => {
      let prod = _products[1];
      expect(prod.images.length).toEqual(1);

      browser.visit(`/product/${prod.friendlyLink}`, (err) => {
        if (err) {
          done.fail(err);
        } 
        browser.assert.success();

        browser.assert.style('section.thumb-viewer figure.product-image', 'visibility', 'visible');
        browser.assert.elements('input[type=radio]', 0);
        done();
      });
    });

    describe('adding product to cart', () => {
      let product;

      beforeEach(() => {
        product = _products[0];
      });

      it('adds an item to the cart session', (done) => {
        browser.pressButton('li.product:nth-child(3) form button[type=submit]', () => {

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
        browser.pressButton('li.product:nth-child(3) form button[type=submit]', () => {
          browser.assert.redirected();
          browser.assert.url('/cart');
          done();
        });
      });
    });

    describe('contextual checkout behaviour', () => {
      it('displays a Continue Shopping button linking to root', (done) => {
        browser.clickLink('Checkout', (err) => {
          if (err) done.fail(err);
          browser.assert.success();
          browser.assert.elements('i.fa.fa-shopping-cart.go-to-shop-lnk', 1);
          browser.assert.link('.navbar-brand', 'Continue shopping', '/');
          done();
        });
      });
    });
  });
});
