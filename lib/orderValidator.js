'use strict';

/**
 * Takes the order form fields and produces an array of error messages
 * if any are missing.
 *
 * @param Object
 *
 * @return Array
 */
const _required = ['recipient', 'street', 'city', 'province', 'country', 'postcode', 'email'];

const validator = function validateCustomerOrderForm(fields) {
  let errors = [];
  let message = '';
  _required.forEach((field) => {
    if (!fields[field] || !fields[field].trim()) {
      switch(field) {
        case 'postcode':
          field = 'postal code';
          break;
      }
      if (message.length) {
        message += `, ${field}`;
      }
      else {
        message = `You must provide ${field === 'email' ? 'an' : 'a'} ${field}`; 
      }
    }
  });

  if (message.length) {
    errors.push({ message: message });
  }

  return errors.length ? errors : false;
}

module.exports = validator;
