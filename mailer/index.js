'use strict';

const nodemailer = require('nodemailer');

module.exports = function() {
  let env = process.env.NODE_ENV || 'development';
  let transport;

  if (env == 'production') {
    transport = {
      service: 'gmail',
      auth: {
        user: process.env.FROM,
        pass: process.env.PASSWORD
      }
    };
  }
  else if (env == 'tor') {
    transport = {
      port: 25,
      host: 'postfix',
      ignoreTLS: true,
      auth: {
        user: process.env.FROM,
        pass: process.env.PASSWORD
      }
    };
  }
  else if (env == 'development') {
    transport = {
      port: 25,
      ignoreTLS: true
    };
  }
  else {
    transport = require('nodemailer-mock-transport')({
      foo: 'bar'
    });
  }

  const transporter = nodemailer.createTransport(transport);
 
  return { transporter: transporter, transport: transport };
}();
