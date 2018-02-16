'use strict';

const Units = require('ethereumjs-units');

class Cart {
  static addToCart(product, option, cart) {
    if (!cart) {
      cart = option;
      option = null;
    }
    let prod = {
      id: product._id,
      name: product.name,
      price: product.price,
      formattedTotal: this.setFormattedTotal(product.price),
      image: product.image,
      option: option
    };
    cart.items.push(prod);
    this.calculateTotals(cart);
  }

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

  static calculateTotals(cart) {
    cart.totals = 0.00;
    cart.items.forEach(item => {
      cart.totals += item.price;
    });
    cart.formattedTotal = this.setFormattedTotal(cart.totals);
  }

  static emptyCart(cart) {
    cart.items = [];
    cart.totals = 0;
    cart.formattedTotal = 0;
  }

  static setFormattedTotal(total) {
    return Number(Units.convert(total, 'gwei', 'eth'));
  }
}

module.exports = Cart;
