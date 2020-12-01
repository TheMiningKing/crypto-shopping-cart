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

    it('displays footer information', () => {
      browser.assert.link('footer#info span:nth-child(1) a', 'Shipping & Returns', '/policy');
      browser.assert.link('footer#info span:nth-child(2) a', 'Questions?', `mailto:${process.env.CONTACT}`);
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
        browser.assert.elements('#currency-nav a', 0);
        browser.assert.elements('#currency-nav span', 0);
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
          browser.assert.elements('#currency-nav a', 0);
          browser.assert.elements('#currency-nav span', 0);
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

                models.Product.find({}).sort('createdAt').then((products) => {
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
          browser.assert.elements('#currency-nav span', 2);
          browser.assert.elements('#currency-nav a', 1);
          browser.assert.element('#currency-nav span:nth-child(2).active', _wallets[0].name, `/cart/set-currency/${_wallets[0].currency}`);
          browser.assert.link('#currency-nav a', _wallets[1].name, `/cart/set-currency/${_wallets[1].currency}`);
        });

//        it('updates product details if a new preferred currency is set', (done) => {
//          // First product
//          browser.assert.text('ul#products li.product:nth-child(1) .cart-data .product-info span.price',
//                              `${_products[0].prices[0].formattedPrice} ${_wallets[0].currency}`);
//          // Second product
//          browser.assert.text('ul#products li.product:nth-child(1) .cart-data .product-info span.price',
//                              `${_products[1].prices[0].formattedPrice} ${_wallets[0].currency}`);
//
//          browser.clickLink(_wallets[1].name, () => {
//            browser.assert.redirected();
//            browser.assert.url('/');
//            browser.assert.text('.alert.alert-info', `Currency switched to ${_wallets[1].currency}`);
//
//            // First product
//            browser.assert.text('ul#products li.product:nth-child(1) .cart-data .product-info span.price',
//                                `${_products[0].prices[1].formattedPrice} ${_wallets[1].currency}`);
//            // Second product
//            browser.assert.text('ul#products li.product:nth-child(1) .cart-data .product-info span.price',
//                                `${_products[1].prices[1].formattedPrice} ${_wallets[1].currency}`);
//            done();
//          });
//        });
//
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
          browser.assert.text('#currency-nav span:nth-child(2).active', _wallets[0].name);
          browser.assert.link('#currency-nav a:nth-child(3)', _wallets[1].name, `/cart/set-currency/${_wallets[1].currency}`);

          browser.clickLink(_wallets[1].name, () => {
            browser.assert.link('#currency-nav a', _wallets[0].name, `/cart/set-currency/${_wallets[0].currency}`);
            browser.assert.text('#currency-nav span.active', _wallets[1].name);
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

    it('does not display empty DB message', () => {
      browser.assert.elements('p.alert.alert-info', 0);
    });


    it('displays a link to the homepage', () => {
      browser.assert.elements('.navbar-header a.navbar-brand[href="/"]', 1);
    });

    it('displays a checkout button', () => {
      browser.assert.elements('i.fa.fa-shopping-cart.go-to-cart-lnk', 1);
    });

    it('structures the image board with what\'s in the database', (done) => {
      models.Product.find({}).sort('createdAt').then((results) => {
        expect(results.length).toEqual(2);

        browser.assert.elements('.image-board-container .image-item', results.length);

        // First product
        browser.assert.element(`.image-board-container figure.image-item a img[src="/images/products/${results[0].images[0]}"]`);
        browser.assert.link(`.image-board-container figure.image-item a`, '', `/product/${results[0].friendlyLink}`);

        // Second product
        browser.assert.element(`.image-board-container figure.image-item img[src="/images/products/${results[1].images[0]}"]`);
        browser.assert.link(`.image-board-container figure.image-item a`, '', `/product/${results[1].friendlyLink}`);
        done();
      }).catch((error) => {
        done.fail(error);
      });
    });

    describe('sold out item', () => {
      let _products;
      beforeEach((done) => {
        models.Product.findOneAndUpdate({ name: 'Men\'s Mining T' }, { quantity: 0 }).then((results) => {
          models.Product.find({}).sort('createdAt').then((results) => {
            _products = results;
            browser.visit('/', (err) => {
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

      it('shows a sold-out ribbon', () =>{
        browser.assert.elements('.image-board-container .image-item img.img-thumbnail.img-responsive', _products.length);

        // Pic 1
        browser.assert.text(`.image-board-container .image-item.side-corner-tag img[src="/images/products/${_products[0].images[0]}"] + p span`, 'SOLD');

        // Pic 2
        browser.assert.elements(`.image-board-container .image-item.side-corner-tag img[src="/images/products/${_products[1].images[0]}"] + p span`, 0);
      });
    });
  });
});
