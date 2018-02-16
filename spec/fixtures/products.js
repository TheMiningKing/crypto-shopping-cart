'use strict';

const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

exports.Product = {
  man_shirt: {
    _id: new ObjectId(),
    name: 'Men\'s Mining T',
    description: 'secret',
    price: 51990000,
    image: 'man-shirt.jpg',
    options: ['Small', 'Medium', 'Large']
  },
  woman_shirt: {
    _id: new ObjectId(),
    name: 'Women\'s Mining T',
    description: 'secret',
    price: 51990000,
    image: 'woman-shirt.jpg',
    options: ['Small', 'Medium', 'Large']
  }
};
