'use strict';

describe('Product', () => {
  const Units = require('ethereumjs-units');
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
                                  description: "Get fired from your job for looking too cool",
                                  price: 0.01 });
 
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
                                  description: "Get fired from your job for looking too cool",
                                  price: 0.01 });
      // Believe it or not, the `undefined` values actually work to
      // verify schema membership
      const expected = {
        name: "Sweet Mining T",
        description: "Get fired from your job for looking too cool",
        price: 0.01,
        image: undefined,
        createdAt: undefined,
        updatedAt: undefined
      };

      expect(product).toEqual(jasmine.objectContaining(expected));
      // Product options array
      expect(product.options.length).toEqual(0);

      // Product categories array
      expect(product.categories.length).toEqual(0);
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
                                    description: "Get fired from your job for looking too cool",
                                    price: 51990000 });

        product.save().then((obj) => {
          expect(product.friendlyLink).toEqual('the-mining-kings-sweet-mining-t-shirts-cheap');
          done();
        }).catch((error) => {
          done.fail(error);
        });
      });

      it('appends a number when there are duplicate friendly links', (done) => {
        let product1 = new Product({ name: "The Mining King's Sweet Mining T-Shirts (cheap!)",
                                     description: "Get fired from your job for looking too cool",
                                     price: 51990000 });

        product1.save().then((obj) => {
          expect(product1.friendlyLink).toEqual('the-mining-kings-sweet-mining-t-shirts-cheap');

          let product2 = new Product({ name: "The Mining King's Sweet Mining T-Shirts (cheap!)",
                                       description: "Get fired from your job for looking too cool",
                                       price: 51990000 });

          product2.save().then((obj) => {
            expect(product2.friendlyLink).toEqual('the-mining-kings-sweet-mining-t-shirts-cheap-2');

            let product3 = new Product({ name: "The Mining King's Sweet Mining T-Shirts (cheap!)",
                                         description: "Get fired from your job for looking too cool",
                                         price: 51990000 });

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

  describe('#formattedPrice', () => {
    it('converts from gwei to eth', (done) => {
      let product = new Product({ name: "Sweet Mining T",
                                  description: "Get fired from your job for looking too cool",
                                  price: 51990000 });
 
      product.save().then((obj) => {
        expect(product.formattedPrice).toEqual(Number(Units.convert(product.price, 'gwei', 'eth')));
        done();
      }).catch((error) => {
        done.fail(error);
      });
    });
  });
});
