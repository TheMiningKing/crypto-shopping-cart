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

//  WalletSchema.virtual('formattedPrice').get(function() {
//    return Number(Units.convert(this.price, 'gwei', 'eth'));
//  });
//
//  WalletSchema.pre('save', function(next) {
//    let self = this;
//    this.friendlyLink = this.name.replace(/\s/gi, '-').replace(/[^\w-]/gi, '').toLowerCase();
//    this.constructor.find({ friendlyLink: new RegExp(this.friendlyLink, 'i') }).then((results) => {
//      if (results.length) {
//        self.friendlyLink += `-${results.length + 1}`;
//      }
//      next();
//    }).catch((err) => {
//      console.log(err);
//      next(err);
//    });
//  });

  return WalletSchema;
};
