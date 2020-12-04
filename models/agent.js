
const bcrypt = require('bcrypt');

module.exports = function(mongoose) {
  const Schema = mongoose.Schema;

  const AgentSchema = new Schema({
    email: {
      type: String,
      trim: true,
      required: [true, 'No email supplied'],
      unique: true,
      empty: [false, 'No email supplied'],
      validate: {
        isAsync: true,
        validator: function(v, cb) {
          if (!this.isNew) return cb();
          this.model('Agent').count({ email: v }).then(count => {
            cb(!count);
          });
        },
        message: 'That email is already registered'
      }
    },
    password: {
      type: String,
      trim: true,
      required: [true, 'No password supplied'],
      empty: [false, 'No password supplied'],
    },
  }, {
    timestamps: true
  });

  const saltRounds = 10;

  AgentSchema.pre('save', function(next) {
    // Check if document is new or a new password has been set
    if (this.isNew || this.isModified('password')) {
      // Saving reference to this because of changing scopes
      const document = this;
      bcrypt.hash(document.password, saltRounds,
        function(err, hashedPassword) {
        if (err) {
          next(err);
        }
        else {
          document.password = hashedPassword;
          next();
        }
      });
    } else {
      next();
    }
  });

  AgentSchema.statics.validPassword = function(password, hash, done, agent) {
    bcrypt.compare(password, hash, function(err, isMatch) {
      if (err) console.log(err);
      if (isMatch) {
        return done(null, agent);
      } else {
        return done(null, false);
      }
    });
  };

  return AgentSchema;
};
