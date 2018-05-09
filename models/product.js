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
    images: [Types.String],
    options: [Types.String],
    categories: [Types.String],
    friendlyLink: Types.String
  }, {
    timestamps: true
  });

  ProductSchema.virtual('formattedPrice').get(function() {
    return Number(Units.convert(this.price, 'gwei', 'eth'));
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
