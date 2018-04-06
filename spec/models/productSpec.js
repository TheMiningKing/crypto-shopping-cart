'use strict';

describe('Product', () => {
 // const Units = require('ethereumjs-units');
  const currencyFormatter = require('currency-formatter');
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
  });
  
  describe('#formattedPrice', () => {
    it('converts from gwei to eth', (done) => {
      let product = new Product({ name: "Sweet Mining T",
                                  description: "Get fired from your job for looking too cool",
                                  price: 51990000 });
 
      product.save().then((obj) => {
        expect(product.formattedPrice).toEqual(currencyFormatter.format(product.price, { code: 'CAD' }));
        done();
      }).catch((error) => {
        done.fail(error);
      });
    });
  });
});
