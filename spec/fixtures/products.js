'use strict';

const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const wallets = require('./wallets').Wallet;

exports.Product = {
  man_shirt: {
    _id: new ObjectId(),
    name: 'Men\'s Mining T',
    description: 'Get fired from your job for looking too cool in this sweet Mining King T',
    prices: [{ price: 51990000, wallet: wallets.eth._id }, { price: 419900, wallet: wallets.btc._id }],
    images: ['man-shirt.jpg', 'man-shirt-back.jpg', 'man-shirt-back-cu.jpg'],
    options: ['Small', 'Medium', 'Large'],
    categories: ['mens'],
    createdAt: new Date((new Date)*1 - 1000*3600*2)
  },
  woman_shirt: {
    _id: new ObjectId(),
    name: 'Women\'s Mining T',
    description: 'Mining Ts are like sexy ladies... they come in all sizes!',
    prices: [{ price: 51990000, wallet: wallets.eth._id }, { price: 419900, wallet: wallets.btc._id }],
    images: ['woman-shirt.jpg'],
    categories: ['womens']
  }
};
