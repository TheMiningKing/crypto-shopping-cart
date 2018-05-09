'use strict';

describe('Product', () => {
  const Units = require('ethereumjs-units');
  const fixtures = require('pow-mongoose-fixtures');
  const db = require('../../models');
  const Product = db.Product;

  afterEach((done) => {
    db.mongoose.connection.db.dropDatabase().then((err, result) => {
      done();
    }).catch((err) => {
      done.fail(err);
    });
  });

  describe('basic validation', () => {
    it('sets the createdAt and updatedAt fields', (done) => {
      let product = new Product({ name: "Sweet Mining T",
                                  description: "Get fired from your job for looking too cool" });
 
      expect(product.createdAt).toBe(undefined);
      expect(product.updatedAt).toBe(undefined);
      product.save().then((obj) => {
        expect(product.createdAt instanceof Date).toBe(true);
        expect(product.updatedAt instanceof Date).toBe(true);
        done();
      }).catch((error) => {
        done.fail(error);
      });
    });

    it('initializes the object with the correct key/value pairs', () => {
      let product = new Product({ name: "Sweet Mining T",
                                  description: "Get fired from your job for looking too cool" });
      // Believe it or not, the `undefined` values actually work to
      // verify schema membership
      const expected = {
        name: "Sweet Mining T",
        description: "Get fired from your job for looking too cool",
        createdAt: undefined,
        updatedAt: undefined
      };

      expect(product).toEqual(jasmine.objectContaining(expected));
      // Product options array
      expect(product.options.length).toEqual(0);

      // Product categories array
      expect(product.categories.length).toEqual(0);

      // Images array
      expect(product.images.length).toEqual(0);

      // Prices array
      expect(product.prices.length).toEqual(0);
    });

    it('does not allow an empty name field', (done) => {
      Product.create({ name: ' ', description: 'test' }).then((obj) => {
        done.fail('This should not have saved');
      }).catch((error) => {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['name'].message).toEqual('No product name supplied');
        done();
      });
    });

    it('does not allow an undefined name field', (done) => {
      Product.create({ description: 'test' }).then((obj) => {
        done.fail('This should not have saved');
      }).catch((error) => {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['name'].message).toEqual('No product name supplied');
        done();
      });
    });

    describe('friendly links', () => {
      it('strips all non-alphanumerics and replaces spaces with dashes', (done) => {
        let product = new Product({ name: "The Mining King's Sweet Mining T-Shirts (cheap!)",
                                    description: "Get fired from your job for looking too cool" });

        product.save().then((obj) => {
          expect(product.friendlyLink).toEqual('the-mining-kings-sweet-mining-t-shirts-cheap');
          done();
        }).catch((error) => {
          done.fail(error);
        });
      });

      it('appends a number when there are duplicate friendly links', (done) => {
        let product1 = new Product({ name: "The Mining King's Sweet Mining T-Shirts (cheap!)",
                                     description: "Get fired from your job for looking too cool" });

        product1.save().then((obj) => {
          expect(product1.friendlyLink).toEqual('the-mining-kings-sweet-mining-t-shirts-cheap');

          let product2 = new Product({ name: "The Mining King's Sweet Mining T-Shirts (cheap!)",
                                       description: "Get fired from your job for looking too cool" });

          product2.save().then((obj) => {
            expect(product2.friendlyLink).toEqual('the-mining-kings-sweet-mining-t-shirts-cheap-2');

            let product3 = new Product({ name: "The Mining King's Sweet Mining T-Shirts (cheap!)",
                                         description: "Get fired from your job for looking too cool" });

            product3.save().then((obj) => {
              expect(product3.friendlyLink).toEqual('the-mining-kings-sweet-mining-t-shirts-cheap-3');
              done();
            }).catch((error) => {
              done.fail(error);
            });
          }).catch((error) => {
            done.fail(error);
          });
        }).catch((error) => {
          done.fail(error);
        });
      });
    });
  });

  describe('multiple currency prices', () => {
    it('does not allow an empty wallet field', (done) => {
      let product = new Product({ name: "Sweet Mining T",
                                  description: "Get fired from your job for looking too cool" });
      product.prices.push({ price: 51990000, wallet: '   '});
 
      product.save().then((obj) => {
        done.fail('This should not have saved');
      }).catch((error) => {
        expect(Object.keys(error.errors).length).toEqual(1);
        // Yuck
        expect(error.errors['prices.0.wallet'].message).
          toEqual('Cast to ObjectID failed for value "   " at path "wallet"');
        done();
      });
    });

    it('does not allow an undefined wallet field', (done) => {
      let product = new Product({ name: "Sweet Mining T",
                                  description: "Get fired from your job for looking too cool" });
      product.prices.push({ price: 51990000 });
 
      product.save().then((obj) => {
        done.fail('This should not have saved');
      }).catch((error) => {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['prices.0.wallet'].message).toEqual('No wallet supplied');
        done();
      });
    });

    it('initializes a price object with the correct key/value pairs', (done) => {
      fixtures.load(__dirname + '/../fixtures/wallets.js', db.mongoose, (err) => {
        if (err) done.fail(err);

        db.Wallet.findOne({ currency: 'ETH' }).then((wallet) => {

          let product = new Product({ name: "Sweet Mining T",
                                      description: "Get fired from your job for looking too cool" });
          product.prices.push({ price: 51990000, wallet: wallet._id });

          product.save().then((result) => {
            expect(product.prices.length).toEqual(1);
            expect(product.prices[0].wallet).toEqual(wallet._id);
            expect(product.prices[0].price).toEqual(51990000);
            done();
          }).catch((error) => {
            done.fail(error);
          });
        }).catch((error) => {
          done.fail(error);
        });
      });
    });

    describe('#formattedPrice', () => {

      let _ethWallet, _btcWallet;
      beforeEach((done) => {
        fixtures.load(__dirname + '/../fixtures/wallets.js', db.mongoose, (err) => {
          if (err) done.fail(err);

          db.Wallet.findOne({ currency: 'ETH' }).then((wallet) => {
            _ethWallet = wallet;
            db.Wallet.findOne({ currency: 'BTC' }).then((wallet) => {
              _btcWallet = wallet;
              done();
            }).catch((error) => {
              done.fail(error);
            });
          }).catch((error) => {
            done.fail(error);
          });
        });
      });

      // The base unit is gwei, no matter the currency
      it('converts from gwei to eth', (done) => {
        let product = new Product({ name: "Sweet Mining T",
                                    description: "Get fired from your job for looking too cool" });
        product.prices.push({ price: 51990000, wallet: _ethWallet._id});
        product.prices.push({ price: 419900, wallet: _btcWallet._id});

        product.save().then((obj) => {
          expect(product.prices[0].formattedPrice).toEqual(Number(Units.convert(51990000, 'gwei', 'eth')));
          expect(product.prices[1].formattedPrice).toEqual(Number(Units.convert(419900, 'gwei', 'eth')));
          done();
        }).catch((error) => {
          done.fail(error);
        });
      });
    });
  });
});
