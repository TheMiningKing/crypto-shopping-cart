'use strict';

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
    options: [Types.String]
  }, {
      timestamps: true
  });

  return ProductSchema;
};
