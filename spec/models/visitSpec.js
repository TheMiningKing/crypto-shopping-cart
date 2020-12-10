'use strict';

describe('Visit', () => {
  const db = require('../../models');
  const Visit = db.Visit;

  const _valid = {
    ip: '127.0.0.1',
    path: '/path/to/some/resource'
  };
//  beforeEach(done => {
//
//    done();
//  });

  afterEach(done => {
    db.mongoose.connection.db.dropDatabase().then((err, result) => {
      done();
    }).catch((err) => {
      done.fail(err);
    });
  });

  describe('basic validation', () => {
    it('sets the createdAt and updatedAt fields', done => {
      let visit = new Visit(_valid);
      expect(visit.createdAt).toBe(undefined);
      expect(visit.updatedAt).toBe(undefined);
      visit.save().then((obj) => {
        expect(visit.createdAt instanceof Date).toBe(true);
        expect(visit.updatedAt instanceof Date).toBe(true);
        done();
      }).catch((error) => {
        done.fail(error);
      });
    });

    describe('ip', () => {
      it('does not allow an empty IP field', done => {
        _valid.ip = '    ';
        Visit.create(_valid).then(obj => {
          done.fail('This should not have saved');
        }).catch(error => {
          expect(Object.keys(error.errors).length).toEqual(1);
          expect(error.errors['ip'].message).toEqual('No visit IP supplied');
          done();
        });
      });

      it('does not allow an invalid IP address', done => {
        _valid.ip = 'this is not an IP address';
        Visit.create(_valid).then(obj => {
          done.fail('This should not have saved');
        }).catch(error => {
          expect(error.message).toEqual('Not a valid IP address');
          done();
        });
      });

      it('allows an IPv4 IP address', done => {
        _valid.ip = '192.167.2.1';
        Visit.create(_valid).then(obj => {
          expect(obj.ip).toEqual('192.167.2.1');
          done();
        }).catch(error => {
          done.fail(error);
        });
      });

      it('allows an IPv6 IP address', done => {
        _valid.ip = '::ffff:127.0.0.1';
        Visit.create(_valid).then(obj => {
          expect(obj.ip).toEqual('::ffff:127.0.0.1');
          done();
        }).catch(error => {
          done.fail(error);
        });
      });
    });

    describe('path', () => {
      it('does not allow an empty path field', done => {
        _valid.path = '    ';
        Visit.create(_valid).then(obj => {
          done.fail('This should not have saved');
        }).catch(error => {
          expect(Object.keys(error.errors).length).toEqual(1);
          expect(error.errors['path'].message).toEqual('No visit path supplied');
          done();
        });
      });

      it('does not allow an invalid path field', done => {
        _valid.path = '!foo.js';
        Visit.create(_valid).then(obj => {
          done.fail('This should not have saved');
        }).catch(error => {
          expect(error.message).toEqual('Not a valid path');
          done();
        });
      });

      it('allows a well-formed resource path', done => {
        _valid.path = '/path/to/some/resource';
        Visit.create(_valid).then(obj => {
          expect(obj.path).toEqual('/path/to/some/resource');
          done();
        }).catch(error => {
          done.fail(error);
        });
      });
    });


    describe('referer', () => {
      it('allows an optional referer', done => {
        _valid.referer = 'http://example.com';
        Visit.create(_valid).then(obj => {
          expect(obj.referer).toEqual('http://example.com');
          done();
        }).catch(error => {
          done.fail(error);
        });
      });
    });
  });
});
