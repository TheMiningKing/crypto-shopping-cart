'use strict';                  

const app = require('../../app'); 
const models = require('../../models');
//const fixtures = require('pow-mongoose-fixtures');

const Browser = require('zombie');
const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001; 
Browser.localhost('example.com', PORT);

describe('index', () => {

  let browser;

  afterEach((done) => {
    models.dropDatabase(() => {
      done();
    });
  });

  it('adds a session containing an empty cart on first visit', (done) => {
    browser = new Browser({ waitDuration: '30s', loadCss: false });

    models.collection('sessions').count({}, (err, results) => {
      if (err) {
        done.fail(err);
      }
      expect(results).toEqual(0);
      browser.visit('/policy', (err) => {
        if (err) {
          done.fail(err);
        }
        models.collection('sessions').find({}).toArray((err, results) => {
          if (err) {
            done.fail(err);
          }
          expect(results.length).toEqual(1);
          expect(results[0].expires).not.toBe(undefined);
          expect(results[0]._id).not.toBe(undefined);

          const session = JSON.parse(results[0].session);
          expect(session).not.toBe(undefined);
          expect(session.cookie).not.toBe(undefined);
          expect(session.cart).not.toBe(undefined);
          expect(session.cart.items).toEqual([]);
          expect(session.cart.totals).toEqual({});
          expect(session.cart.preferredCurrency).toEqual(process.env.PREFERRED_CURRENCY);

          done();
        });
      });
    });
  });

  describe('page content', () => {
    beforeEach((done) => {
      browser.visit('/policy', (err) => {
        if (err) {
          done.fail(err);
        }
        browser.assert.success();
        done();
      });
    });

    it('displays a contact email', () => {
      browser.assert.link(`a[href="mailto:${process.env.CONTACT}"]`, process.env.CONTACT, `mailto:${process.env.CONTACT}`);
    });

    it('displays the site name', () => {
      // Two mentions. TODO: test for actual content
      browser.assert.elements('span.name', 2);
    });
  });
});


