'use strict';

/**
 * Takes the order form fields and produces an array of error messages
 * if any are missing.
 *
 * @param Object
 *
 * @return Array
 */
const _required = ['recipient', 'street', 'city', 'province', 'country', 'postcode'];

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
        message = `You must provide a ${field}`; 
      }
    }
  });

  if (message.length) {
    errors.push({ message: message });
  }

  // Email and transactions are a special case (they're not included in _required array)
  if (!fields.email || !fields.email.trim()) {
    if (fields.contact) {
      errors.push({ message: 'You requested email confirmation. You must provide an email.' });
    } else if ((!fields.transaction || !fields.transaction.trim())) {
      errors.push({ message: 'You must provide a transaction ID if not completing order via email' });
    }
  }

  return errors.length ? errors : false;
}

module.exports = validator;
