'use strict';

describe('Agent', () => {
  const db = require('../../models');
  const Agent = db.Agent;

  let agent;

  beforeEach(done => {
    agent = new Agent({ email: 'someguy@example.com', password: 'secret' });
    done();
  });

  afterEach(done => {
    db.mongoose.connection.db.dropDatabase().then(result => {
      done();
    }).catch(err => {
      done.fail(err);
    });
  });

  describe('basic validation', () => {
    it('sets the createdAt and updatedAt fields', done => {
      expect(agent.createdAt).toBe(undefined);
      expect(agent.updatedAt).toBe(undefined);
      agent.save().then(obj => {
        expect(agent.createdAt instanceof Date).toBe(true);
        expect(agent.updatedAt instanceof Date).toBe(true);
        done();
      }).catch(err => {
        done.fail(err);
      });
    });

    it("encrypts the agent's password", done => {
      expect(agent.password).toEqual('secret');
      agent.save().then(obj => {
        Agent.findById(obj._id).then(results => {
          expect(results.password).not.toEqual('secret');
          done();
        }).catch(err => {
          done.fail(err);
        });
      }).catch(err => {
        done.fail(err);
      });
    });

    it('does not allow two identical emails', done => {
      agent.save().then(obj => {
        Agent.create({ email: 'someguy@example.com', password: 'secret' }).then(obj => {
          done.fail('This should not have saved');
        }).catch(error => {
          expect(Object.keys(error.errors).length).toEqual(1);
          expect(error.errors['email'].message).toEqual('That email is already registered');
          done();
        });
      }).catch(error => {
        done.fail(error);
      });
    });

    it('does not allow an empty email field', done => {
      Agent.create({ email: ' ', password: 'secret' }).then(obj => {
        done.fail('This should not have saved');
      }).catch(error => {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['email'].message).toEqual('No email supplied');
        done();
      });
    });

    it('does not allow an undefined email field', done => {
      Agent.create({ password: 'secret' }).then(obj => {
        done.fail('This should not have saved');
      }).catch(error => {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['email'].message).toEqual('No email supplied');
        done();
      });
    });

    it('does not allow an empty password field', done => {
      Agent.create({ email: 'someguy@example.com', password: '   ' }).then(obj => {
        done.fail('This should not have saved');
      }).catch(error => {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['password'].message).toEqual('No password supplied');
        done();
      });
    });

    it('does not allow an undefined password field', done => {
      Agent.create({ email: 'someguy@example.com' }).then(obj => {
        done.fail('This should not have saved');
      }).catch(error => {
        expect(Object.keys(error.errors).length).toEqual(1);
        expect(error.errors['password'].message).toEqual('No password supplied');
        done();
      });
    });

    it('does not re-hash a password on update', done => {
      agent.save().then(obj => {
        let passwordHash = agent.password;
        agent.email = 'newemail@example.com';
        agent.save().then(obj => {
          expect(agent.password).toEqual(passwordHash);
          done();
        });
      });
    });

    /**
     * .validPassword
     */
    describe('.validPassword', () => {
      beforeEach(done => {
        agent.save().then(obj => {
          done();
        });
      });

      it('returns true if the password is a match', done => {
        Agent.validPassword('secret', agent.password, (err, res) => {
          expect(res).toEqual(agent);
          done();
        }, agent);
      });

      it('returns false if the password is not a match', done => {
        Agent.validPassword('wrongsecretpassword', agent.password, (err, res) => {
          expect(res).toBe(false);
          done();
        }, agent);
      });
    });
  });
});
