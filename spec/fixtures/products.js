'use strict';

const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

exports.Product = {
  man_shirt: {
    _id: new ObjectId(),
    name: 'Men\'s Mining T',
    description: 'Get fired from your job for looking too cool in this sweet Mining King T',
    price: 51990000,
    image: 'man-shirt.jpg',
    options: ['Small', 'Medium', 'Large'],
    categories: ['mens']
  },
  woman_shirt: {
    _id: new ObjectId(),
    name: 'Women\'s Mining T',
    description: 'Mining Ts are like sexy ladies... they come in all sizes!',
    price: 51990000,
    image: 'woman-shirt.jpg',
    categories: ['womens']
  }
};
