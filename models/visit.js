'use strict';

const ip = require('ip');
const isValid = require('is-valid-path');

module.exports = function(mongoose) {
  const Schema = mongoose.Schema;
  const Types = Schema.Types;

  /**
   * Visit
   */
  const VisitSchema = new Schema({
    ip: {
      type: Types.String,
      trim: true,
      required: [true, 'No visit IP supplied'],
      empty: [false, 'No visit IP supplied']
    },
    path: {
      type: Types.String,
      trim: true,
      required: [true, 'No visit path supplied'],
      empty: [false, 'No visit path supplied']
    },
    referer: {
      type: Types.String,
    },
  }, {
    timestamps: true
  });

  /**
   * Check IP address
   */
  VisitSchema.pre('save', function(next) {
    if (ip.isV4Format(this.ip) || ip.isV6Format(this.ip)){
      next();
    }
    else {
      next(new Error('Not a valid IP address'));
    }
  });

  /**
   * Check visited pathname
   */
  VisitSchema.pre('save', function(next) {
    if (isValid(this.path)) {
      next();
    }
    else {
      next(new Error('Not a valid path'));
    }
  });

  return VisitSchema;
};
