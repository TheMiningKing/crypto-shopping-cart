'use strict';

const Units = require('ethereumjs-units');

module.exports = function(mongoose) {
  const Schema = mongoose.Schema;
  const Types = Schema.Types;

  const WalletSchema = new Schema({
    currency: {
      type: Types.String,
      trim: true,
      required: [true, 'No wallet currency supplied'],
      empty: [false, 'No wallet currency supplied']
    },
    address: {
      type: Types.String,
      trim: true,
      required: [true, 'No wallet address supplied'],
      empty: [false, 'No wallet address supplied']
    }
  }, {
    timestamps: true
  });

  return WalletSchema;
};
