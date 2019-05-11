'use strict';

const Units = require('ethereumjs-units');
const showdown  = require('showdown');
const converter = new showdown.Converter();

module.exports = function(mongoose) {
  const Schema = mongoose.Schema;
  const Types = Schema.Types;

  /**
   * Allows multiple currencies with varying prices
   */
  const PriceSchema = new Schema({
    price: {
      type: Types.Number,
      default: 0
    },
    wallet: {
      type: Types.ObjectId,
      required: [true, 'No wallet supplied'],
      ref: 'Wallet'
    }
  });

  PriceSchema.virtual('formattedPrice').get(function() {
    return Number(Units.convert(this.price, 'gwei', 'eth'));
  })

  /**
   * Product
   */
  const ProductSchema = new Schema({
    name: {
      type: Types.String,
      trim: true,
      required: [true, 'No product name supplied'],
      empty: [false, 'No product name supplied']
    },
    description: {
      type: Types.String,
      trim: true
    },
    quantity: {
      type: Types.Number,
      default: 1
    },
    prices: [PriceSchema],
    images: [Types.String],
    options: [Types.String],
    categories: [Types.String],
    friendlyLink: Types.String
  }, {
    timestamps: true
  });

  ProductSchema.virtual('descriptionHtml').get(function() {
    return converter.makeHtml(this.description);
  });

  ProductSchema.pre('save', function(next) {
    let self = this;
    this.friendlyLink = this.name.replace(/\s/gi, '-').replace(/[^\w-]/gi, '').toLowerCase();
    this.constructor.find({ friendlyLink: new RegExp(this.friendlyLink, 'i') }).then((results) => {
      if (results.length) {
        self.friendlyLink += `-${results.length + 1}`;
      }
      next();
    }).catch((err) => {
      console.log(err);
      next(err);
    });
  });

  return ProductSchema;
};
