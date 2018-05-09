'use strict';

const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

exports.Wallet = {
  eth: {
    _id: new ObjectId(),
    currency: 'ETH',
    address: '0x123abc'
  },
  btc: {
    _id: new ObjectId(),
    currency: 'BTC',
    address: '0x123abc'
  }
};
