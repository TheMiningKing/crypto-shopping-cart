'use strict';

const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

exports.Wallet = {
  eth: {
    _id: new ObjectId(),
    currency: 'ETH',
    address: '0x123abc',
    name: 'Ethereum',
    createdAt: new Date((new Date)*1 - 1000*3600*2)
  },
  btc: {
    _id: new ObjectId(),
    currency: 'BTC',
    address: '0x123abc',
    name: 'Bitcoin'
  }
};
