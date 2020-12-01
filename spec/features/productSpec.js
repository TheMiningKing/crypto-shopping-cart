'use strict';

const app = require('../../app');
const models = require('../../models');
const fixtures = require('pow-mongoose-fixtures');

const Browser = require('zombie');
const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;

const showdown  = require('showdown');
const converter = new showdown.Converter();

Browser.localhost('example.com', PORT);

describe('products', () => {

  let browser, _products;

  afterEach((done) => {
    models.dropDatabase(() => {
      done();
    });
  });

  describe('/product', () => {

    it('adds a session containing an empty cart on first visit', (done) => {
      browser = new Browser({ waitDuration: '30s', loadCss: false });

      models.collection('sessions').count({}, (err, results) => {
        if (err) {
          done.fail(err);
        }
        expect(results).toEqual(0);
        browser.visit('/product', (err) => {
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
            expect(results[0].session.cart.totals).toEqual({});
            expect(results[0].session.cart.preferredCurrency).toEqual(process.env.PREFERRED_CURRENCY);
            expect(results[0].expires).not.toBe(undefined);
            done();
          });
        });
      });
    });

    describe('when database is empty', () => {
      beforeEach((done) => {
        browser = new Browser({ waitDuration: '30s', loadCss: false });

        browser.visit('/product', (err) => {
          if (err) done.fail(err);
          browser.assert.success();
          done();
        });
      });

      it('displays a no-products-in-db message', () => {
        browser.assert.text('.alert.alert-info', 'Sorry, no products to show.');
      });

      it('displays footer information', () => {
        browser.assert.link('footer#info span:nth-child(1) a', 'Shipping & Returns', '/policy');
        browser.assert.link('footer#info span:nth-child(2) a', 'Questions?', `mailto:${process.env.CONTACT}`);
      });
    });

    describe('when database contains products', () => {
      beforeEach((done) => {
        browser = new Browser({ waitDuration: '30s', loadCss: false });
        fixtures.load(__dirname + '/../fixtures/wallets.js', models.mongoose, (err) => {
          if (err) done.fail(err);

          fixtures.load(__dirname + '/../fixtures/products.js', models.mongoose, (err) => {
            if (err) done.fail(err);

            models.Product.find({}).sort('createdAt').then((results) => {
              _products = results;

              browser.visit('/product', (err) => {
                if (err) done.fail(err);
                browser.assert.success();
                done();
              });
            });
          });
        });
      });

      it('does not display empty DB messge', () => {
        browser.assert.elements('p.alert.alert-info', 0);
      });

      it('displays a link to the home page', () => {
        browser.assert.elements('.navbar-header a.navbar-brand[href="/"]', 1);
      });

      it('displays a checkout button', () => {
        browser.assert.elements('i.fa.fa-shopping-cart.go-to-cart-lnk', 1);
      });

      it('structures the product list with what\'s in the database', (done) => {
        models.Product.find({}).sort('createdAt').then((results) => {
          expect(results.length).toEqual(2);

          browser.assert.elements('ul#products li.product', results.length);

          // First product
          browser.assert.text('ul#products li.product:nth-child(1) h3.product-title', results[0].name);
          browser.assert.element(`ul#products li.product figure.product-image a img[src="/images/products/${results[0].images[0]}"]`);
          browser.assert.link(`ul#products li.product figure.product-image a`, '', `/product/${results[0].friendlyLink}`);
          expect(browser.html()).toMatch(new RegExp(converter.makeHtml(results[0].descriptionHtml)));
          browser.assert.text('ul#products li.product:nth-child(1) span.price',
                              `${results[1].prices[0].formattedPrice} ${process.env.PREFERRED_CURRENCY}`);
          browser.assert.text(`ul#products li.product:nth-child(1) form input[type=hidden][name=id][value="${results[0].id}"]`);

          // Second product
          expect(browser.html()).toMatch(new RegExp(converter.makeHtml(results[1].descriptionHtml)));
          browser.assert.element(`ul#products li.product figure.product-image img[src="/images/products/${results[1].images[0]}"]`);
          browser.assert.text('ul#products li.product:nth-child(2) span.price',
                              `${results[1].prices[0].formattedPrice} ${process.env.PREFERRED_CURRENCY}`);
          browser.assert.text(`ul#products li.product:nth-child(2) form input[type=hidden][name=id][value="${results[1].id}"]`);

          done();
        }).catch((error) => {
          done.fail(error);
        });
      });

      it('converts the product descriptions from markdown to HTML', (done) => {
        models.Product.findOneAndUpdate({ name: 'Men\'s Mining T' }, { description: '# Awesome Mining T' }, { 'new': true }).then((results) => {

          models.Product.find({}).sort('createdAt').then((results) => {
            expect(results.length).toEqual(2);

            browser.assert.elements('ul#products li.product', results.length);

            browser.visit(`/product`, (err) => {
              if (err) {
                done.fail(err);
              }
              browser.assert.success();

              // Man's t-shirt (testing that showdown is doing something... very ad hoc)
              browser.assert.text('ul#products li.product:nth-child(1) .product-description h1#awesomeminingt', 'Awesome Mining T');
              expect(browser.html()).toMatch(new RegExp(converter.makeHtml(results[0].description)));

              // Woman's t-shirt
              expect(browser.html()).toMatch(new RegExp(converter.makeHtml(results[1].description)));
              done();
            });
          }).catch((error) => {
            done.fail(error);
          });
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
          browser.assert.element('ul#products li.product:nth-child(1) form select');
          browser.assert.elements('ul#products li.product:nth-child(1) form select option',
                                  results[0].options.length);

          browser.assert.text(`ul#products li.product:nth-child(1) select option[value=${results[0].options[0]}]`,
                              results[0].options[0]);
          browser.assert.text(`ul#products li.product:nth-child(1) select option[value=${results[0].options[1]}]`,
                              results[0].options[1]);
          browser.assert.text(`ul#products li.product:nth-child(1) select option[value=${results[0].options[2]}]`,
                              results[0].options[2]);

          // Second product (no dropdown)
          browser.assert.text('ul#products li.product:nth-child(2) h3.product-title', results[1].name);
          browser.assert.elements('ul#products li.product:nth-child(2) form select', 0);

          done();
        }).catch((error) => {
          done.fail(error);
        });
      });

      describe('sold out item', () => {

        beforeEach((done) => {
          models.Product.findOneAndUpdate({ name: 'Men\'s Mining T' }, { quantity: 0 }).then((results) => {
            models.Product.find({}).sort('createdAt').then((results) => {
              _products = results;
              browser.visit('/product', (err) => {
                if (err) {
                  done.fail(err);
                }
                done();
              });
            }).catch((error) => {
              done.fail(error);
            });
          }).catch((error) => {
            done.fail(error);
          });
        });

        it('doesn\'t show an add-to-cart button', () =>{
          browser.assert.elements('ul#products li.product', _products.length);

          // First product (sold out)
          browser.assert.text('ul#products li.product:nth-child(1) h3.product-title', _products[0].name);
          browser.assert.elements(`ul#products li.product:nth-child(1) form input[type=hidden][name=id][value="${_products[0].id}"]`, 0);

          // Second product
          browser.assert.text('ul#products li.product:nth-child(2) h3.product-title', _products[1].name);
          browser.assert.element(`ul#products li.product:nth-child(2) form input[type=hidden][name=id][value="${_products[1].id}"]`);
        });

        it('shows a sold-out ribbon', () =>{
          // First product (sold out)
          browser.assert.text('ul#products li.product:nth-child(1) h3.product-title', _products[0].name);
          browser.assert.text(`.product-image.side-corner-tag img[src="/images/products/${_products[0].images[0]}"] + p span`, 'SOLD');

          // Second product
          browser.assert.text('ul#products li.product:nth-child(2) h3.product-title', _products[1].name);
          browser.assert.elements(`.product-image.side-corner-tag img[src="/images/products/${_products[1].images[0]}"] + p span`, 0);
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
              expect(results[0].session.cart.totals['ETH'].total).toEqual(product.prices[0].price);
              expect(results[0].session.cart.totals['BTC'].total).toEqual(product.prices[1].price);
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

  describe('/product/:friendlyLink', () => {
    beforeEach((done) => {
      browser = new Browser({ waitDuration: '30s', loadCss: false });
      fixtures.load(__dirname + '/../fixtures/wallets.js', models.mongoose, (err) => {
        if (err) done.fail(err);

        fixtures.load(__dirname + '/../fixtures/products.js', models.mongoose, (err) => {
          if (err) done.fail(err);

          models.Product.find({}).sort('createdAt').then((results) => {
            _products = results;
            done();
          });
        });
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
            expect(results[0].session.cart.totals).toEqual({});
            expect(results[0].session.cart.preferredCurrency).toEqual(process.env.PREFERRED_CURRENCY);
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

      it('does not display a currency menu', () => {
        browser.assert.elements('#currency-nav a', 0);
        browser.assert.elements('#currency-nav span', 0);
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

        // Man's t-shirt
        browser.assert.text('.image-board-container .image-item span.price',
                            `${prod.prices[0].formattedPrice} ${process.env.PREFERRED_CURRENCY}`);
        browser.assert.text('h3.product-title', prod.name);
        browser.assert.element(`.image-board-container .image-item img[src="/images/products/${prod.images[0]}"]`);
        browser.assert.text('.image-board-container .image-item .product-description', prod.description);
        browser.assert.text(`.image-board-container .image-item form input[type=hidden][name=id][value="${prod.id}"]`);
      });

      it('displays the product options if present', () => {
        let prod = _products[0];
        browser.assert.element('.image-board-container .image-item form select');
        browser.assert.elements('.image-board-container .image-item form select option', prod.options.length);
        browser.assert.text(`.image-board-container .image-item select option[value=${prod.options[0]}]`, prod.options[0]);
        browser.assert.text(`.image-board-container .image-item select option[value=${prod.options[1]}]`, prod.options[1]);
        browser.assert.text(`.image-board-container .image-item select option[value=${prod.options[2]}]`, prod.options[2]);
      });

      it('displays product thumbnail images if there is more than one', () => {
        let prod = _products[0];
        browser.assert.elements('.image-board-container .image-item img', prod.images.length);

        // Pic 1
        browser.assert.element(`.image-board-container .image-item img[src="/images/products/${prod.images[0]}"]`);

        // Pic 2
        browser.assert.element(`.image-board-container .image-item img[src="/images/products/${prod.images[1]}"]`);

        // Pic 3
        browser.assert.element(`.image-board-container .image-item img[src="/images/products/${prod.images[2]}"]`);
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
          browser.assert.text('.image-board-container .image-item span.price',
                              `${prod.prices[0].formattedPrice} ${process.env.PREFERRED_CURRENCY}`);
          browser.assert.text('h3.product-title', prod.name);
          browser.assert.element(`.image-board-container .image-item img[src="/images/products/${prod.images[0]}"]`);
          expect(browser.html()).toMatch(new RegExp(converter.makeHtml(prod.description)));
          browser.assert.text(`.image-board-container .image-item form input[type=hidden][name=id][value="${prod.id}"]`);

          done();
        });
      });

      it('converts the product description from markdown to HTML', (done) => {
        models.Product.findOneAndUpdate({ name: 'Men\'s Mining T' }, { description: '# Awesome Mining T' }, { 'new': true }).then((results) => {

          browser.visit(`/product/${_products[0].friendlyLink}`, (err) => {
            if (err) {
              done.fail(err);
            }
            browser.assert.success();

            // Man's t-shirt (testing that showdown is doing something... very ad hoc)
            browser.assert.text('.image-board-container .image-item .product-description h1#awesomeminingt', 'Awesome Mining T');
            expect(browser.html()).toMatch(new RegExp(converter.makeHtml(results.description)));

            done();
          });
        }).catch((error) => {
          done.fail(error);
        });
      });

      it('displays a link to the next product in inventory', (done) => {
        browser.assert.link('#next-item-link', 'Next Item', `/product/${_products[1].friendlyLink}`);
        browser.clickLink('Next Item', (err) => {
          if (err) done.fail(err);
          browser.assert.success();
          browser.assert.url(`/product/${_products[1].friendlyLink}`);
          done();
        });
      });

      it('displays a link to the landing page if looking at the last item in inventory', (done) => {
        browser.clickLink('Next Item', (err) => {
          if (err) done.fail(err);
          browser.assert.success();
          browser.assert.link('#next-item-link', 'Next Item', '/');
          browser.clickLink('Next Item', (err) => {
            if (err) done.fail(err);
            browser.assert.success();
            browser.assert.url('/');
            done();
          });
        });
      });

      describe('adding product to cart', () => {
        let product;

        beforeEach(() => {
          product = _products[0];
        });

        it('adds an item to the cart session', (done) => {
          browser.pressButton('form.add-to-cart-form button.add-to-cart[type=submit]', () => {
          models.collection('sessions').find({}).toArray((err, results) => {
            if (err) {
              done.fail(err);
            }
            expect(results.length).toEqual(1);
              expect(results[0]._id).not.toBe(undefined);
              expect(results[0].session).not.toBe(undefined);
              expect(results[0].session.cookie).not.toBe(undefined);
              expect(results[0].session.cart).not.toBe(undefined);
              expect(results[0].session.cart.items.length).toEqual(1);
              expect(results[0].session.cart.totals[process.env.PREFERRED_CURRENCY].total).toEqual(product.prices[0].price);
              expect(results[0].expires).not.toBe(undefined);
              done();
            });
          });
        });

        it('redirects to cart', (done) => {
          browser.pressButton('form.add-to-cart-form button.add-to-cart[type=submit]', () => {
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

    describe('currency dropdown', () => {

      describe('products in database', () => {

        describe('one currency accepted', () => {
          beforeEach((done) => {
            models.Wallet.remove({ currency: 'BTC' }).then((wallet) => {
              browser.visit(`/product/${_products[0].friendlyLink}`, (err) => {
                if (err) done.fail(err);
                browser.assert.success();
                done();
              });
            }).catch((error) => {
              done.fail();
            });
          });

          it('does not display if there is only one accepted currency', () => {
            browser.assert.elements('#currency-nav a', 0);
            browser.assert.elements('#currency-nav span', 0);
          });
        });

        describe('multiple currencies accepted', () => {

          let _wallets;
          beforeEach((done) => {
            models.Wallet.find({}).sort('createdAt').then((wallets) => {
              _wallets = wallets;
              browser.visit(`/product/${_products[0].friendlyLink}`, (err) => {
                if (err) done.fail(err);
                browser.assert.success();
                done();
              });
            }).catch((error) => {
              done.fail(error);
            });
          });

          it('displays the accepted currencies as links', () => {
            browser.assert.elements('#currency-nav span', 2);
            browser.assert.elements('#currency-nav a', 1);
            browser.assert.element('#currency-nav span:nth-child(2).active', _wallets[0].name, `/cart/set-currency/${_wallets[0].currency}`);
            browser.assert.link('#currency-nav a', _wallets[1].name, `/cart/set-currency/${_wallets[1].currency}`);
          });

          it('updates product details if a new preferred currency is set', (done) => {
            // Product
            browser.assert.text('.image-board-container .image-item span.price',
                                `${_products[0].prices[0].formattedPrice} ${_wallets[0].currency}`);

            browser.clickLink(_wallets[1].name, () => {
              browser.assert.redirected();
              browser.assert.url(`/product/${_products[0].friendlyLink}`);
              browser.assert.text('.alert.alert-info', `Currency switched to ${_wallets[1].currency}`);

              // Product
              browser.assert.text('.image-board-container .image-item span.price',
                                  `${_products[0].prices[1].formattedPrice} ${_wallets[1].currency}`);
              done();
            });
          });

          it('sets the preferred currency in the cart session', (done) => {
            models.collection('sessions').find({}).toArray((err, results) => {
              if (err) {
                done.fail(err);
              }
              expect(results.length).toEqual(1);
              expect(results[0].session.cart.preferredCurrency).toEqual(_wallets[0].currency);

              browser.clickLink(_wallets[1].name, () => {

                models.collection('sessions').find({}).toArray((err, results) => {
                  if (err) {
                    done.fail(err);
                  }
                  expect(results.length).toEqual(1);
                  expect(results[0].session.cart.preferredCurrency).toEqual(_wallets[1].currency);
                  done();
                });
              });
            });
          });
        });
      });
    });
  });
});
