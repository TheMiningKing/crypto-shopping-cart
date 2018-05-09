'use strict';

describe('Wallet', () => {
//  const Units = require('ethereumjs-units');
  const db = require('../../models');
  const Wallet = db.Wallet;

  afterEach((done) => {
    db.mongoose.connection.db.dropDatabase().then((err, result) => {
      done();
    }).catch((err) => {
      done.fail(err);
    });
  });

  describe('basic validation', () => {
    it('sets the createdAt and updatedAt fields', (done) => {
      let wallet = new Wallet({ currency: "ETH", address: "0x123abc" });
 
      expect(wallet.createdAt).toBe(undefined);
      expect(wallet.updatedAt).toBe(undefined);
      wallet.save().then((obj) => {
        expect(wallet.createdAt instanceof Date).toBe(true);
        expect(wallet.updatedAt instanceof Date).toBe(true);
        done();
      }).catch((error) => {
        done.fail(error);
      });
    });

    it('initializes the object with the correct key/value pairs', () => {
      let wallet = new Wallet({ currency: "     ETH   ", address: " 0x123abc  " });
      // Believe it or not, the `undefined` values actually work to
      // verify schema membership
      const expected = {
        currency: "ETH",
        address: "0x123abc",
        createdAt: undefined,
        updatedAt: undefined
      };

      expect(wallet).toEqual(jasmine.objectContaining(expected));
    });

    it('does not allow an empty currency field', (done) => {
      Wallet.create({ currency: '    ', address: '0x123abc' }).then((obj) => {
        done.fail('This should not have saved');
      }).catch((error) => {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['currency'].message).toEqual('No wallet currency supplied');
        done();
      });
    });

    it('does not allow an undefined currency field', (done) => {
      Wallet.create({ address: '0x123abc' }).then((obj) => {
        done.fail('This should not have saved');
      }).catch((error) => {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['currency'].message).toEqual('No wallet currency supplied');
        done();
      });
    });

    it('does not allow an empty address field', (done) => {
      Wallet.create({ currency: 'ETH', address: '   ' }).then((obj) => {
        done.fail('This should not have saved');
      }).catch((error) => {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['address'].message).toEqual('No wallet address supplied');
        done();
      });
    });

    it('does not allow an undefined address field', (done) => {
      Wallet.create({ currency: 'ETH' }).then((obj) => {
        done.fail('This should not have saved');
      }).catch((error) => {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['address'].message).toEqual('No wallet address supplied');
        done();
      });
    });
  });
});
