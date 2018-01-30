'use strict';

const bcrypt = require('bcrypt-nodejs');

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
    }
  }, {
      timestamps: true
  });

  return ProductSchema;
};
