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

    models.collection('sessions').count({}, (err, results) => {
      if (err) {
        done.fail(err);
      }
      expect(results).toEqual(0);
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
          expect(results[0].session.cart.totals).toEqual({});
          expect(results[0].session.cart.preferredCurrency).toEqual(process.env.PREFERRED_CURRENCY);
          expect(results[0].expires).not.toBe(undefined);
          done();
        });
      });
    });
  });

  // A tad redundant, but important enough for a separate test
  it('sets the preferred currency in session cart on first visit', (done) => {
    browser = new Browser({ waitDuration: '30s', loadCss: false });
    expect(process.env.PREFERRED_CURRENCY).not.toBe(undefined);

    browser.visit('/', (err) => {
      if (err) {
        done.fail(err);
      }
      models.collection('sessions').find({}).toArray((err, results) => {
        if (err) {
          done.fail(err);
        }
        expect(results.length).toEqual(1);
        expect(results[0].session.cart.preferredCurrency).toEqual(process.env.PREFERRED_CURRENCY);
        done();
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

  describe('currency menu', () => {

    describe('no products in database', () => {
      beforeEach((done) => {
        browser = new Browser({ waitDuration: '30s', loadCss: false });
  
        browser.visit('/', (err) => {
          if (err) done.fail(err);
          browser.assert.success();
          done();
        });
      });

      it('does not display a currency menu', () => {
        browser.assert.elements('.currency-nav a', 0);
        browser.assert.elements('.currency-nav span', 0);
      });
    });

    describe('products in database', () => {

      describe('one currency accepted', () => {
        beforeEach((done) => {
          models.Wallet.create({ currency: 'ETH', address: '0x123abc', name: 'Ethereum'}).then((wallet) => {
            models.Product.create({
              name: 'shirt',
              prices: [{ price: 51990000, wallet: wallet._id }],
              images: ['man-shirt.jpg'],
            }).then((results) => {
              browser.visit('/', (err) => {
                if (err) done.fail(err);
                browser.assert.success();
                done();
              });
            }).catch((error) => {
              done.fail();
            });
          }).catch((error) => {
            done.fail();
          });
        });

        it('does not display if there is only one accepted currency', () => {
          browser.assert.elements('.currency-nav a', 0);
          browser.assert.elements('.currency-nav span', 0);
        });
      });
  
      describe('multiple currencies accepted', () => {

        let _wallets, _products;
        beforeEach((done) => {
          fixtures.load(__dirname + '/../fixtures/wallets.js', models.mongoose, (err) => {
            if (err) done.fail(err);

            models.Wallet.find({}).sort('createdAt').then((wallets) => {
              _wallets = wallets;

              fixtures.load(__dirname + '/../fixtures/products.js', models.mongoose, (err) => {
                if (err) done.fail(err);

                models.Product.find({}).then((products) => {
                  _products = products;

                  browser.visit('/', (err) => {
                    if (err) done.fail(err);
                    browser.assert.success();
                    done();
                  });
                }).catch((error) => {
                  done.fail(error);
                });
              });
            }).catch((error) => {
              done.fail(error);
            });
          });
        });

        it('displays the accepted currencies as links', () => {
          browser.assert.elements('.currency-nav span', 2);
          browser.assert.elements('.currency-nav a', 1);
          browser.assert.element('.currency-nav span:nth-child(2).active', _wallets[0].name, `/cart/set-currency/${_wallets[0].currency}`);
          browser.assert.link('.currency-nav a', _wallets[1].name, `/cart/set-currency/${_wallets[1].currency}`);
        });

        it('updates product details if a new preferred currency is set', (done) => {
          // First product
          browser.assert.text('ul#products li.product:nth-child(1) .cart-data .product-info span.price',
                              `${_products[0].prices[0].formattedPrice} ${_wallets[0].currency}`);
          // Second product
          browser.assert.text('ul#products li.product:nth-child(1) .cart-data .product-info span.price',
                              `${_products[1].prices[0].formattedPrice} ${_wallets[0].currency}`);
 
          browser.clickLink(_wallets[1].name, () => {
            browser.assert.redirected();
            browser.assert.url('/');
            browser.assert.text('.alert.alert-info', `Currency switched to ${_wallets[1].currency}`);

            // First product
            browser.assert.text('ul#products li.product:nth-child(1) .cart-data .product-info span.price',
                                `${_products[0].prices[1].formattedPrice} ${_wallets[1].currency}`);
            // Second product
            browser.assert.text('ul#products li.product:nth-child(1) .cart-data .product-info span.price',
                                `${_products[1].prices[1].formattedPrice} ${_wallets[1].currency}`);
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

        it('disables the active currency link', (done) => {
          browser.assert.text('.currency-nav span:nth-child(2).active', _wallets[0].name);
          browser.assert.link('.currency-nav a:nth-child(3)', _wallets[1].name, `/cart/set-currency/${_wallets[1].currency}`);

          browser.clickLink(_wallets[1].name, () => {
            browser.assert.link('.currency-nav a', _wallets[0].name, `/cart/set-currency/${_wallets[0].currency}`);
            browser.assert.text('.currency-nav span.active', _wallets[1].name);
            done();
          });
        });

        it('doesn\'t barf if the currency doesn\'t exist', (done) => {
          browser.visit('/cart/set-currency/DOGE', () => {
            browser.assert.redirected();
            browser.assert.url('/');
            browser.assert.text('.alert.alert-danger', 'DOGE is not currently accepted');
            done();
          });
        });
      });
    });
  });

  describe('when database contains products', () => {

    let _wallets;
    beforeEach((done) => {
      browser = new Browser({ waitDuration: '30s', loadCss: false });

      fixtures.load(__dirname + '/../fixtures/wallets.js', models.mongoose, (err) => {
        if (err) done.fail(err);
        models.Wallet.find({}).sort('createdAt').then((wallets) => {
          _wallets = wallets;

          fixtures.load(__dirname + '/../fixtures/products.js', models.mongoose, (err) => {
            if (err) done.fail(err);
            browser.visit('/', (err) => {
              if (err) done.fail(err);
              browser.assert.success();
              done();
            });
          });
        }).catch((error) => {
          done.fail(error);
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
        browser.assert.element(`ul#products li.product figure.product-image a img[src="/images/products/${results[0].images[0]}"]`);
        browser.assert.link(`ul#products li.product figure.product-image a`, '', `/product/${results[0].friendlyLink}`);
        browser.assert.text('ul#products li.product:nth-child(1) .product-description', results[0].description);
        browser.assert.text('ul#products li.product:nth-child(1) .cart-data .product-info span.price',
                            `${results[0].prices[0].formattedPrice} ${_wallets[0].currency}`);
 
        browser.assert.text(`ul#products li.product:nth-child(1) .cart-data form input[type=hidden][name=id][value="${results[0].id}"]`);

        // Second product
        browser.assert.text('ul#products li.product:nth-child(2) .product-description', results[1].description);
        browser.assert.element(`ul#products li.product figure.product-image a img[src="/images/products/${results[1].images[0]}"]`);
        browser.assert.link(`ul#products li.product figure.product-image a`, '', `/product/${results[1].friendlyLink}`);
        browser.assert.text('ul#products li.product:nth-child(1) .cart-data .product-info span.price',
                            `${results[1].prices[0].formattedPrice} ${_wallets[0].currency}`);
 
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

