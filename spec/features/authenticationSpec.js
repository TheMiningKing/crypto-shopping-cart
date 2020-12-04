'use strict';
const app = require('../../app');

const Browser = require('zombie');
const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const models = require('../../models');
const request = require('supertest');

Browser.localhost('example.com', PORT);

describe('authentication', () => {

  let browser, agent, album;

  beforeEach(done => {
    browser = new Browser({ waitDuration: '30s', loadCss: false });
    models.Agent.create({ email: 'someguy@example.com', password: 'secret' }).then(result => {
      agent = result;

      browser.visit('/login', err => {
        if (err) return done.fail(err);
        browser.assert.success();
        done();
      });
    }).catch(error => {
      done.fail(error);
    });
  });

  afterEach(done => {
    models.mongoose.connection.db.dropDatabase().then((err, result) => {
      done();
    }).catch(err => {
      done.fail(err);
    });
  });

  it('displays the login form if not logged in', () => {
    browser.assert.attribute('form', 'action', '/login');
  });

  it('does not display the logout button if not logged in', () => {
    expect(browser.query("a[href='/logout']")).toBeNull();
  });

  describe('login process', () => {

    describe('unsuccessful', () => {
      it('shows an error message when password omitted', done => {
        browser.fill('email', agent.email);
        browser.pressButton('Login', err => {
          if (err) done.fail(err);
          browser.assert.text('.alert.alert-danger', 'Invalid email or password');
          done();
        });
      });

      it('shows an error message when email is omitted', done => {
        browser.fill('password', agent.password);
        browser.pressButton('Login', err => {
          if (err) done.fail(err);
          browser.assert.text('.alert.alert-danger', 'Invalid email or password');
          done();
        });
      });

      it('shows an error message when password and email are omitted', done => {
        browser.pressButton('Login', err => {
          if (err) done.fail(err);
          browser.assert.text('.alert.alert-danger', 'Invalid email or password');
          done();
        });
      });

      it('shows an error message when password is wrong', done => {
        browser.fill('email', agent.email);
        browser.fill('password', 'wrong');
        browser.pressButton('Login', err => {
          if (err) done.fail(err);
          browser.assert.text('.alert.alert-danger', 'Invalid email or password');
          done();
        });
      });

      it('shows an error message when email doesn\'t exist', done => {
        browser.fill('email', 'nosuchguy@example.com');
        browser.fill('password', 'wrong');
        browser.pressButton('Login', err => {
          if (err) done.fail(err);
          browser.assert.text('.alert.alert-danger', 'Invalid email or password');
          done();
        });
      });
    });

    describe('successful', () => {
      beforeEach(done => {
        browser.fill('email', agent.email);
        browser.fill('password', 'secret');
        browser.pressButton('Login', err => {
          if (err) done.fail(err);
          browser.assert.success();
          done();
        });
      });

//      it('lands in the right spot', () => {
//        browser.assert.url({ pathname: '/invoice' });
//      });
//
//      it('displays a nav menu', () => {
//        browser.assert.element('a[href="/logout"]');
//        browser.assert.element('a[href="/invoice"]');
//      });
//
//      it('/login redirects to /invoice', done => {
//        browser.visit('/login', err => {
//          if (err) return done.fail(err);
//          browser.assert.url({ pathname: '/invoice' });
//          done();
//        });
//      });
//
//      it('displays a friendly greeting', () => {
//        browser.assert.text('.alert', 'Hello, ' + agent.email + '!');
//      });
//
//      describe('logout', () => {
//        it('lands in the right spot', done => {
//          browser.clickLink('Logout', err => {
//            if (err) {
//              done.fail(err);
//            }
//            browser.assert.success();
//            browser.assert.url({ pathname: '/' });
//            done();
//          });
//        });
//
//        it('removes the session', done => {
//          models.db.collection('sessions').find().toArray((err, sessions) => {
//            if (err) {
//              return done.fail(err);
//            }
//            expect(sessions.length).toEqual(1);
//
//            // Can't click logout because it will create a new empty session
//            request(app)
//              .get('/logout')
//              .set('Cookie', browser.cookies)
//              .set('Accept', 'application/json')
//              .expect(302)
//              .end((err, res) => {
//                if (err) done.fail(err);
//
//                models.db.collection('sessions').find().toArray((err, sessions) => {
//                  if (err) {
//                    return done.fail(err);
//                  }
//                  expect(sessions.length).toEqual(0);
//                  done();
//                });
//              });
//          });
//        });
//      });
    });
  });
});
