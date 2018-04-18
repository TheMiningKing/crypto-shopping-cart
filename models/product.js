'use strict';

const Units = require('ethereumjs-units');

module.exports = function(mongoose) {
  const Schema = mongoose.Schema;
  const Types = Schema.Types;

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
    price: {
      type: Types.Number,
      default: 0
    },
    image: {
      type: Types.String,
      trim: true
    },
    options: [Types.String],
    categories: [Types.String]
  }, {
    timestamps: true
  });

  ProductSchema.virtual('formattedPrice').get(function() {
    return Number(Units.convert(this.price, 'gwei', 'eth'));
  });

  return ProductSchema;
};
