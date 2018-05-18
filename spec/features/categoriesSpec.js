'use strict';                  

const app = require('../../app'); 
const models = require('../../models');
const fixtures = require('pow-mongoose-fixtures');

const Browser = require('zombie');
const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001; 
Browser.localhost('example.com', PORT);

describe('categories', () => {

  let browser;
  beforeEach(() => {
    browser = new Browser({ waitDuration: '30s', loadCss: false });
  });

  afterEach((done) => {
    models.dropDatabase(() => {
      done();
    });
  });
 
  describe('products in database', () => {
    let _products;
    beforeEach((done) => {
  
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
            expect(results[0].session.cart.totals).toEqual({});
            expect(results[0].session.cart.preferredCurrency).toEqual(process.env.PREFERRED_CURRENCY);
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

      it('does not display a currency menu', () => {
        browser.assert.elements('.currency-nav a', 0);
        browser.assert.elements('.currency-nav span', 0);
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
        models.Product.find({ categories: 'mens' }).populate('prices.wallet').sort('createdAt').then((results) => {
          expect(results.length).toEqual(1);
          expect(results[0].categories.length).toEqual(1);
          expect(results[0].categories[0]).toEqual('mens');
  
          browser.assert.elements('ul#products li.product', results.length);
  
          // Man's t-shirt
          browser.assert.text('ul#products li.product:nth-child(1) h3.product-title', results[0].name);
          browser.assert.element(`ul#products li.product figure.product-image img[src="/images/products/${results[0].images[0]}"]`);
          browser.assert.text('ul#products li.product:nth-child(1) .product-description', results[0].description);
          expect(results[0].prices[0].wallet.currency).toEqual(process.env.PREFERRED_CURRENCY);
          browser.assert.text('ul#products li.product:nth-child(1) .cart-data .product-info span.price',
                              `${results[0].prices[0].formattedPrice} ${process.env.PREFERRED_CURRENCY}`);
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

  describe('currency menu', () => {

    describe('no products in database', () => {
      beforeEach((done) => {
        browser = new Browser({ waitDuration: '30s', loadCss: false });
  
        browser.visit('/category/nosuchproduct', (err) => {
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
              categories: ['mens']
            }).then((results) => {
              browser.visit('/category/mens', (err) => {
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

                models.Product.find({}).sort('createdAt').then((products) => {
                  _products = products;

                  browser.visit('/category/mens', (err) => {
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
          // Product
          browser.assert.element('ul#products li', 1);
          browser.assert.text('ul#products li.product:nth-child(1) .cart-data .product-info span.price',
                              `${_products[0].prices[0].formattedPrice} ${_wallets[0].currency}`);
 
          browser.clickLink(_wallets[1].name, () => {
            browser.assert.redirected();
            browser.assert.url('/category/mens');
            browser.assert.text('.alert.alert-info', `Currency switched to ${_wallets[1].currency}`);

            // Product
            browser.assert.element('ul#products li', 1);
            browser.assert.text('ul#products li.product:nth-child(1) .cart-data .product-info span.price',
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
