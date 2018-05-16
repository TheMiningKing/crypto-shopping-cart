'use strict';                  

const Cart = require('../../lib/cart');
const fixtures = require('pow-mongoose-fixtures');
const models = require('../../models');
const Units = require('ethereumjs-units');

describe('Cart', () => {
  let _product;

  beforeEach((done) => {
    fixtures.load(__dirname + '/../fixtures/wallets.js', models.mongoose, (err) => {
      if (err) done.fail(err);
      fixtures.load(__dirname + '/../fixtures/products.js', models.mongoose, (err) => {
        if (err) done.fail(err);
        models.Product.findOne({}).populate({ path: 'prices.wallet' }).then((results) => {
          _product = results;
          done();
        }).catch((err) => {
          done.fail(err);
        });
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
      Cart.addToCart(_product, "Large", cartSession);
      expect(cartSession.items.length).toEqual(1);
    });

    it('calculates the total value of the cart for each currency', () => {
      Cart.addToCart(_product, "Large", cartSession);
      expect(cartSession.items.length).toEqual(1);
      expect(cartSession.totals['ETH'].total).toEqual(_product.prices[0].price);
      expect(cartSession.totals['BTC'].total).toEqual(_product.prices[1].price);
    });

    it('sets the formatted total value', () => {
      Cart.addToCart(_product, "Large", cartSession);
      expect(cartSession.items.length).toEqual(1);
      expect(cartSession.totals['ETH'].formattedTotal).toEqual(Number(Units.convert(_product.prices[0].price, 'gwei', 'eth')));
      expect(cartSession.totals['BTC'].formattedTotal).toEqual(Number(Units.convert(_product.prices[1].price, 'gwei', 'eth')));
    });

    it('sets a product option to null if not specified as a parameter', () => {
      expect(cartSession.items.length).toEqual(0);
      Cart.addToCart(_product, cartSession);
      expect(cartSession.items.length).toEqual(1);
      expect(cartSession.items[0].option).toBe(null);
    });

    it('sets formatted prices for the individual products', () => {
      expect(cartSession.items.length).toEqual(0);
      Cart.addToCart(_product, cartSession);
      expect(cartSession.items.length).toEqual(1);
      expect(cartSession.items[0].prices['ETH'].formattedPrice).
        toEqual(Number(Units.convert(cartSession.items[0].prices['ETH'].price, 'gwei', 'eth')));
      expect(cartSession.items[0].prices['BTC'].formattedPrice).
        toEqual(Number(Units.convert(cartSession.items[0].prices['BTC'].price, 'gwei', 'eth')));
    });
  });

  describe('.removeFromCart', () => {
    let cartSession;

    beforeEach(() => {
      cartSession = { items: [] };
    });

    it('removes a product from the cart session object passed as a parameter', () => {
      Cart.addToCart(_product, "Large", cartSession);
      expect(cartSession.items.length).toEqual(1);

      Cart.removeFromCart(_product._id, "Large", cartSession);
      expect(cartSession.items.length).toEqual(0);
    });

    it('removes all totals if cart is empty as a result', () => {
      Cart.addToCart(_product, "Large", cartSession);
      expect(cartSession.totals['ETH'].formattedTotal).toEqual(Number(Units.convert(_product.prices[0].price, 'gwei', 'eth')));
      expect(cartSession.totals['BTC'].formattedTotal).toEqual(Number(Units.convert(_product.prices[1].price, 'gwei', 'eth')));

      Cart.removeFromCart(_product._id, "Large", cartSession);
      expect(cartSession.totals).toEqual({});
    });

    it('recalculates cart totals', () => {
      Cart.addToCart(_product, "Large", cartSession);
      Cart.addToCart(_product, "Small", cartSession);
      expect(cartSession.totals['ETH'].total).toEqual(_product.prices[0].price * 2);
      expect(cartSession.totals['BTC'].total).toEqual(_product.prices[1].price * 2);

      Cart.removeFromCart(_product._id, "Large", cartSession);
      expect(cartSession.totals['ETH'].total).toEqual(_product.prices[0].price);
      expect(cartSession.totals['BTC'].total).toEqual(_product.prices[1].price);
    });


    it('recalculates cart formatted totals', () => {
      Cart.addToCart(_product, "Large", cartSession);
      Cart.addToCart(_product, "Small", cartSession);
      expect(cartSession.totals['ETH'].formattedTotal).toEqual(Number(Units.convert(_product.prices[0].price, 'gwei', 'eth')) * 2);
      expect(cartSession.totals['BTC'].formattedTotal).toEqual(Number(Units.convert(_product.prices[1].price, 'gwei', 'eth')) * 2);

      Cart.removeFromCart(_product._id, "Large", cartSession);
      expect(cartSession.totals['ETH'].formattedTotal).toEqual(Number(Units.convert(_product.prices[0].price, 'gwei', 'eth')));
      expect(cartSession.totals['BTC'].formattedTotal).toEqual(Number(Units.convert(_product.prices[1].price, 'gwei', 'eth')));
    });

    it('doesn\'t remove a product if the option parameter provides no match', () => {
      Cart.addToCart(_product, "Large", cartSession);
      expect(cartSession.items.length).toEqual(1);

      Cart.removeFromCart(_product._id, "Small", cartSession);
      expect(cartSession.items.length).toEqual(1);
    });

    it('removes only one product from the cart session object passed as a parameter', () => {
      Cart.addToCart(_product, "Large", cartSession);
      Cart.addToCart(_product, "Small", cartSession);
      Cart.addToCart(_product, "Large", cartSession);
      expect(cartSession.items.length).toEqual(3);

      Cart.removeFromCart(_product._id, "Large",  cartSession);
      expect(cartSession.items.length).toEqual(2);
      expect(cartSession.items[0].option).toEqual("Small");
      expect(cartSession.items[1].option).toEqual("Large");
    });

    it('doesn\'t barf if removing a non-existent product from the cart session object', () => {
      Cart.addToCart(_product, "Large", cartSession);
      expect(cartSession.items.length).toEqual(1);
      Cart.removeFromCart('nosuchid', "Large",  cartSession);
      expect(cartSession.items.length).toEqual(1);
    });

    it('doesn\'t barf if removing a non-existent product from an empty cart session object', () => {
      expect(cartSession.items.length).toEqual(0);
      Cart.removeFromCart(_product._id, "Large",  cartSession);
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
      expect(cartSession.totals).toEqual({ });
      Cart.addToCart(_product, "Large", cartSession);
      Cart.calculateTotals(cartSession);
      expect(cartSession.totals['ETH'].total).toEqual(_product.prices[0].price);
      expect(cartSession.totals['BTC'].total).toEqual(_product.prices[1].price);
      Cart.addToCart(_product, "Large", cartSession);
      Cart.calculateTotals(cartSession);
      expect(cartSession.totals['ETH'].total).toEqual(_product.prices[0].price * 2);
      expect(cartSession.totals['BTC'].total).toEqual(_product.prices[1].price * 2);
    });

    it('calculates and sets the formatted totals on the order', () => {
      Cart.calculateTotals(cartSession);
      expect(cartSession.totals).toEqual({});
      Cart.addToCart(_product, "Large", cartSession);
      Cart.calculateTotals(cartSession);
      expect(cartSession.totals['ETH'].formattedTotal).toEqual(Number(Units.convert(_product.prices[0].price, 'gwei', 'eth')));
      expect(cartSession.totals['BTC'].formattedTotal).toEqual(Number(Units.convert(_product.prices[1].price, 'gwei', 'eth')));
      Cart.addToCart(_product, "Large", cartSession);
      Cart.calculateTotals(cartSession);
      expect(cartSession.totals['ETH'].formattedTotal).toEqual(Number(Units.convert(_product.prices[0].price, 'gwei', 'eth')) * 2);
      expect(cartSession.totals['BTC'].formattedTotal).toEqual(Number(Units.convert(_product.prices[1].price, 'gwei', 'eth')) * 2);
    });
  });

  describe('.emptyCart', () => {
    let cartSession;

    beforeEach(() => {
      cartSession = { items: [] };
      Cart.addToCart(_product, "Large", cartSession);
      Cart.addToCart(_product, "Small", cartSession);
      Cart.addToCart(_product, "Large", cartSession);
      expect(cartSession.items.length).toEqual(3);

      expect(cartSession.totals['ETH'].total).toEqual(_product.prices[0].price * 3);
      expect(cartSession.totals['BTC'].total).toEqual(_product.prices[1].price * 3);

      expect(cartSession.totals['ETH'].formattedTotal).toEqual(Number(Units.convert(_product.prices[0].price * 3, 'gwei', 'eth')));
      expect(cartSession.totals['BTC'].formattedTotal).toEqual(Number(Units.convert(_product.prices[1].price * 3, 'gwei', 'eth')));
    });

    it('empties the cart and resets all the values', () => {
      Cart.emptyCart(cartSession);
      expect(cartSession.items.length).toEqual(0);
      expect(cartSession.totals).toEqual({});
    });

    it('empties order details', () => {
      Cart.purchase({ transaction: '0x50m3crazy1d' }, cartSession);
      Cart.emptyCart(cartSession);
      expect(cartSession.order).toBe(undefined);
    });
  });

  describe('.purchase', () => {
    let cartSession;

    beforeEach(() => {
      cartSession = { items: [] };
    });

    it('adds order details to the cart', () => {
      const order = {
        transaction: '0x50m3crazy1d',
        recipient: 'Anonymous',
        street: '123 Fake Street',
        city: 'The C-Spot',
        province: 'AB',
        country: 'No thanks',
        postcode: 'T1K-5B3',
        contact: '1',
        email: 'me@example.com'
      };

      Cart.purchase(order, cartSession);
      expect(cartSession.order.transaction).toEqual(order.transaction);
      expect(cartSession.order.recipient).toEqual(order.recipient);
      expect(cartSession.order.street).toEqual(order.street);
      expect(cartSession.order.city).toEqual(order.city);
      expect(cartSession.order.province).toEqual(order.province);
      expect(cartSession.order.postcode).toEqual(order.postcode);
      expect(cartSession.order.contact).toEqual(order.contact);
      expect(cartSession.order.email).toEqual(order.email);
    });
  });

  describe('.getEmptyCart', () => {
    it('returns an empty cart object', () => {
      const cart = Cart.getEmptyCart();
      expect(cart.items).toEqual([]);
      expect(cart.totals).toEqual({});
      expect(cart.preferredCurrency).toEqual(process.env.PREFERRED_CURRENCY);
    });
  });
});
