'use strict';

const Units = require('ethereumjs-units');

class Cart {

  /**
   * addToCart
   */
  static addToCart(product, option, cart) {
    if (!cart) {
      cart = option;
      option = null;
    }

    let prod = {
      id: product._id,
      name: product.name,
      prices: {},
      image: product.images[0],
      option: option,
    };

    // Get relevant price info
    product.prices.forEach((price) => {
      prod.prices[price.wallet.currency] = {
        price: price.price,
        formattedPrice: price.formattedPrice
      }
    });

    cart.items.push(prod);
    this.calculateTotals(cart);
  }

  /**
   * removeFromCart
   */
  static removeFromCart(id, option, cart) {
    for(let i = 0; i < cart.items.length; i++) {
      let item = cart.items[i];
      if (item.id.toString() === id.toString() && item.option === option) {
        cart.items.splice(i, 1);
        break;
      }
    };
    this.calculateTotals(cart);
  }

  /**
   * calculateTotals
   */
  static calculateTotals(cart) {
    cart.totals = { currencies: {} };
    cart.items.forEach((item) => {
      for (let currency in item.prices) {
        if (!cart.totals.currencies[currency]) {
          cart.totals.currencies[currency] = { total: 0 };
        } 
        cart.totals.currencies[currency].total += item.prices[currency].price;
        cart.totals.currencies[currency].formattedTotal = this.getFormattedPrice(cart.totals.currencies[currency].total);
      };
    });
  }

  /**
   * emptyCart
   */
  static emptyCart(cart) {
    cart.items = [];
    cart.totals = { currencies: {} } 
    delete cart.order;
  }

  /**
   * getFormattedPrice
   */
  static getFormattedPrice(total) {
    return Number(Units.convert(total, 'gwei', 'eth'));
  }

  /**
   * purchase
   */
  static purchase(order, cart) {
    cart.order = order;
  }
}

module.exports = Cart;
