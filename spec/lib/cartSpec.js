'use strict';                  

const Cart = require('../../lib/cart');
const fixtures = require('pow-mongoose-fixtures');
const models = require('../../models');

describe('Cart', () => {
  let product;

  beforeEach((done) => {
    fixtures.load(__dirname + '/../fixtures/products.js', models.mongoose, (err) => {
      if (err) done.fail(err);
      models.Product.findOne({}, (err, results) => {
        if (err) done.fail(err);
        product = results;
        done();
      });
    });
  });

  afterEach((done) => {
    models.dropDatabase(() => {
      done();
    });
  });

  describe('.addToCart', () => {
    let cartSession;

    beforeEach(() => {
      cartSession = { items: [] };
    });

    it('adds a product to the cart session object passed as a parameter', () => {
      expect(cartSession.items.length).toEqual(0);
      Cart.addToCart(product, "Large", cartSession);
      expect(cartSession.items.length).toEqual(1);
    });

    it('calculates the total value of the cart', () => {
      Cart.addToCart(product, "Large", cartSession);
      expect(cartSession.items.length).toEqual(1);
      expect(cartSession.totals).toEqual(product.price);
    });

    it('sets a product option to null if not specified as a parameter', () => {
      expect(cartSession.items.length).toEqual(0);
      Cart.addToCart(product, cartSession);
      expect(cartSession.items.length).toEqual(1);
      expect(cartSession.items[0].option).toBe(null);
    });
  });

  describe('.removeFromCart', () => {
    let cartSession;

    beforeEach(() => {
      cartSession = { items: [] };
    });

    it('removes a product from the cart session object passed as a parameter', () => {
      Cart.addToCart(product, "Large", cartSession);
      expect(cartSession.items.length).toEqual(1);

      Cart.removeFromCart(product._id, "Large", cartSession);
      expect(cartSession.items.length).toEqual(0);
    });

    it('recalculate cart total order price', () => {
      Cart.addToCart(product, "Large", cartSession);
      expect(cartSession.totals).toEqual(product.price);

      Cart.removeFromCart(product._id, "Large", cartSession);
      expect(cartSession.totals).toEqual(0);
    });

    it('doesn\'t remove a product if the option parameter provides no match', () => {
      Cart.addToCart(product, "Large", cartSession);
      expect(cartSession.items.length).toEqual(1);

      Cart.removeFromCart(product._id, "Small", cartSession);
      expect(cartSession.items.length).toEqual(1);
    });

    it('removes only one product from the cart session object passed as a parameter', () => {
      Cart.addToCart(product, "Large", cartSession);
      Cart.addToCart(product, "Small", cartSession);
      Cart.addToCart(product, "Large", cartSession);
      expect(cartSession.items.length).toEqual(3);

      Cart.removeFromCart(product._id, "Large",  cartSession);
      expect(cartSession.items.length).toEqual(2);
      expect(cartSession.items[0].option).toEqual("Small");
      expect(cartSession.items[1].option).toEqual("Large");
    });

    it('doesn\'t barf if removing a non-existent product from the cart session object', () => {
      Cart.addToCart(product, "Large", cartSession);
      expect(cartSession.items.length).toEqual(1);
      Cart.removeFromCart('nosuchid', "Large",  cartSession);
      expect(cartSession.items.length).toEqual(1);
    });

    it('doesn\'t barf if removing a non-existent product from an empty cart session object', () => {
      expect(cartSession.items.length).toEqual(0);
      Cart.removeFromCart(product._id, "Large",  cartSession);
      expect(cartSession.items.length).toEqual(0);
    });
  });

  describe('.calculateTotals', () => {
    let cartSession;

    beforeEach(() => {
      cartSession = { items: [] };
    });

    it('calculates and sets the total order price', () => {
      Cart.calculateTotals(cartSession);
      expect(cartSession.totals).toEqual(0)
      Cart.addToCart(product, "Large", cartSession);
      Cart.calculateTotals(cartSession);
      expect(cartSession.totals).toEqual(product.price)
      Cart.addToCart(product, "Large", cartSession);
      Cart.calculateTotals(cartSession);
      expect(cartSession.totals).toEqual(product.price * 2)
    });

    it('calculates a zero total on an empty cart', () => {
      expect(cartSession.totals).toBe(undefined)
      Cart.calculateTotals(cartSession);
      expect(cartSession.totals).toBe(0)
    });
  });

  describe('.emptyCart', () => {
    let cartSession;

    beforeEach(() => {
      cartSession = { items: [] };
      Cart.addToCart(product, "Large", cartSession);
      Cart.addToCart(product, "Small", cartSession);
      Cart.addToCart(product, "Large", cartSession);
      expect(cartSession.items.length).toEqual(3);
      expect(cartSession.totals).toEqual(product.price * 3);
    });

    it('empties the cart and resets all the values', () => {
      Cart.emptyCart(cartSession);
      expect(cartSession.items.length).toEqual(0);
      expect(cartSession.totals).toEqual(0);
    });
  });
});
