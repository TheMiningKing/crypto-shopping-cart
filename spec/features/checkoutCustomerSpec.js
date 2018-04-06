'use strict';                  

const app = require('../../app'); 
const models = require('../../models');
const mailer = require('../../mailer');
const fixtures = require('pow-mongoose-fixtures');
const path = require('path');

const Browser = require('zombie');
const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001; 
Browser.localhost('example.com', PORT);

describe('checkout', () => {

  let browser, products;
  beforeEach((done) => {
    browser = new Browser({ waitDuration: '30s', loadCss: false });

    fixtures.load(__dirname + '/../fixtures/products.js', models.mongoose, (err) => {
      if (err) done.fail(err);

      models.Product.find({}).sort('createdAt').then((results) => {
        products = results;
        done();
      });
    });
  });

  afterEach((done) => {
    models.dropDatabase(() => {
      mailer.transport.sentMail = [];
      done();
    });
  });

  describe('when cart contains products', () => {
    beforeEach((done) => {
      browser.visit('/', (err) => {
        if (err) done.fail(err);

        browser.pressButton('li.product:nth-child(1) form button[type=submit]', () => {

          browser.visit('/', (err) => {
            if (err) done.fail(err);

            browser.pressButton('li.product:nth-child(2) form button[type=submit]', () => {
              browser.assert.redirected();
              browser.assert.url('/cart');
              done();
            });
          });
        });
      });
    });

    describe('order processing', () => {
      const _order = {
        recipient: 'Anonymous',
        street: '123 Fake St',
        city: 'The C-Spot',
        province: 'AB',
        country: 'Canada',
        postcode: 'T1K-5B3',
        email: 'me@example.com'
      };

      let cart;

      beforeEach((done) => {
        browser.assert.url('/cart');
        models.collection('sessions').findOne({}, (err, result) => {
          if (err) {
            done.fail(err);
          }
          cart = result.session.cart;
          expect(cart.items.length).toEqual(2);

          browser.fill('recipient', _order.recipient);
          browser.fill('street', _order.street);
          browser.fill('city', _order.city);
          browser.fill('province', _order.province);
          browser.fill('country', _order.country);
          browser.fill('postcode', _order.postcode);
 
          done();
        });
      });

      describe('customer experience', () => {

        describe('customer email transaction', () => {
  
          beforeEach(() => {
            browser.fill('email', _order.email);
          });
 
          describe('all products are distinct', () => {
  
            beforeEach((done) => {
              browser.pressButton('Place Order', () => {
                browser.assert.success();  
                done();
              });
            });
      
            it('redirects and displays a flash message on the homepage', () => {
              browser.assert.redirected();
              browser.assert.url('/');
              browser.assert.text('.alert-success', `Your order has been received. Transaction instructions will be sent to ${_order.email}`);
            });

            it('sends an email with correct header information to the vendor', () => {
              expect(mailer.transport.sentMail.length).toEqual(2);
              expect(mailer.transport.sentMail[0].data.to).toEqual(process.env.FROM);
              expect(mailer.transport.sentMail[0].data.from).toEqual(_order.email);
              expect(mailer.transport.sentMail[0].data.subject).toEqual('New order received - unpaid');
            });

            it('sends an email with correct header information to the buyer', () => {
              expect(mailer.transport.sentMail.length).toEqual(2);
              expect(mailer.transport.sentMail[1].data.to).toEqual(_order.email);
              expect(mailer.transport.sentMail[1].data.from).toEqual(process.env.FROM);
              expect(mailer.transport.sentMail[1].data.subject).toEqual('Order received - payment instructions');
            });
      
            it('sends an email with text content to the buyer', () => {
              const text = mailer.transport.sentMail[1].data.text;
              expect(text).toContain('Thank you for your order!');
              expect(text).toContain('Your order is on hold until we confirm your Interac e-Transfer has been received.');

              // Send $___ to ___ 
              expect(text).toContain(`${cart.formattedTotal}`);
              expect(text).toContain(`${process.env.INTERAC_EMAIL}`);
              // Interac e-Transfer
              expect(text).toContain(process.env.RECIPIENT_NAME);
              expect(text).toContain(process.env.SECURITY_QUESTION);
              expect(text).toContain(process.env.SECURITY_ANSWER);

              expect(text).toContain(
                `1. ${cart.items[0].name} - ${cart.items[0].option}, ${cart.items[0].formattedPrice}`);
              expect(text).toContain(`2. ${cart.items[1].name}, ${cart.items[1].formattedPrice}`);
              expect(text).toContain(`TOTAL: ${cart.formattedTotal}`);
      
              expect(text).toContain('Once your payment has been accepted, your order will be processed and shipped to:');
              expect(text).toContain(_order.recipient);
              expect(text).toContain(_order.street);
              expect(text).toContain(_order.city);
              expect(text).toContain(_order.province);
              expect(text).toContain(_order.postcode);
              expect(text).toContain(_order.country);
              expect(text).toContain('Reply to this email with any questions');
            });
      
            it('sends an email with html content to the buyer', (done) => {
              const html = mailer.transport.sentMail[1].data.html;
              expect(html).toContain('<h3>Thank you for your order!</h3>');
      
              expect(html).toContain(`<img src="cid:${cart.items[0].image}"`);
              expect(html).toContain(cart.items[0].name);
              expect(html).toContain(`- ${cart.items[0].option}`);
              expect(html).toContain(cart.items[0].formattedPrice);
      
              expect(html).toContain(`<img src="cid:${cart.items[1].image}"`);
              expect(html).toContain(cart.items[1].name);
              expect(html).toContain(cart.items[1].formattedPrice);
       
              expect(html).toContain(`Total: ${cart.formattedTotal}`);
      
              // Send $___ to ___ 
              expect(html).toContain(`${cart.formattedTotal}`);
              expect(html).toContain(`${process.env.INTERAC_EMAIL}`);
              // Interac e-Transfer
              expect(html).toContain(process.env.RECIPIENT_NAME);
              expect(html).toContain(process.env.SECURITY_QUESTION);
              expect(html).toContain(process.env.SECURITY_ANSWER);

              // Shipping details
              expect(html).toContain('Once your payment has been accepted, your order will be processed and shipped to:');
              expect(html).toContain(_order.recipient);
              expect(html).toContain(_order.street);
              expect(html).toContain(_order.city);
              expect(html).toContain(_order.province);
              expect(html).toContain(_order.postcode);
              expect(html).toContain(_order.country);
              expect(html).toContain('Reply to this email with any questions.');

              // File attachments 
              const attachments = mailer.transport.sentMail[0].data.attachments;
              expect(attachments.length).toEqual(2);
              expect(attachments[0].filename).toEqual(cart.items[0].image);
              expect(attachments[0].path).toEqual(path.resolve(__dirname, '../../public/images/products', cart.items[0].image));
              expect(attachments[0].cid).toEqual(cart.items[0].image);
              expect(attachments[1].filename).toEqual(cart.items[1].image);
              expect(attachments[1].path).toEqual(path.resolve(__dirname, '../../public/images/products', cart.items[1].image));
              expect(attachments[1].cid).toEqual(cart.items[1].image);
              expect(attachments[1].filename).toEqual(cart.items[1].image);
              expect(attachments[1].path).toEqual(path.resolve(__dirname, '../../public/images/products', cart.items[1].image));
              expect(attachments[1].cid).toEqual(cart.items[1].image);
      
              done();
            });
      
            it('empties the buyer\'s cart', (done) => {
              models.collection('sessions').find({}).toArray((err, results) => {
                if (err) {
                  done.fail(err);
                }
                expect(results.length).toEqual(1);
                expect(results[0].session.cart.items.length).toEqual(0);
                expect(results[0].session.cart.totals).toEqual(0);
                expect(results[0].session.cart.formattedTotal).toEqual(0);
      
                done();
              });
            });
          });
    
          describe('contains duplicate products', () => {
            beforeEach((done) => {
              models.Product.find({}).sort('createdAt').then((results) => {
                products = results;
      
                browser.visit('/', (err) => {
                  if (err) done.fail(err);
      
                  browser.pressButton('li.product:nth-child(1) form button[type=submit]', () => {
      
                    browser.visit('/', (err) => {
                      if (err) done.fail(err);
      
                      browser.pressButton('li.product:nth-child(2) form button[type=submit]', () => {
                        browser.assert.redirected();
                        browser.assert.url('/cart');
    
                        models.collection('sessions').findOne({}, (err, result) => {
                          if (err) {
                            done.fail(err);
                          }
                          cart = result.session.cart;
                          expect(cart.items.length).toEqual(4);

                          browser.fill('recipient', _order.recipient);
                          browser.fill('street', _order.street);
                          browser.fill('city', _order.city);
                          browser.fill('province', _order.province);
                          browser.fill('country', _order.country);
                          browser.fill('postcode', _order.postcode);
                          browser.fill('email', _order.email).pressButton('Place Order', () => {
                            browser.assert.success();  
                            done();
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
  
            it('does not attach duplicate product images to the HTML email', (done) => {
              const html = mailer.transport.sentMail[1].data.html;
              expect(html).toContain('<h3>Thank you for your order!</h3>');

              expect(html).toContain(`<img src="cid:${cart.items[0].image}"`);
              expect(html).toContain(cart.items[0].name);
              expect(html).toContain(`- ${cart.items[0].option}`);
              expect(html).toContain(cart.items[0].formattedPrice);

              expect(html).toContain(`<img src="cid:${cart.items[1].image}"`);
              expect(html).toContain(cart.items[1].name);
              expect(html).toContain(cart.items[1].formattedPrice);

              expect(html).toContain(`Total: ${cart.formattedTotal}`);

              // Send $___ to ___
              expect(html).toContain(`${cart.formattedTotal}`);
              expect(html).toContain(process.env.INTERAC_EMAIL);
              // Interac e-Transfer
              expect(html).toContain(process.env.RECIPIENT_NAME);
              expect(html).toContain(process.env.SECURITY_QUESTION);
              expect(html).toContain(process.env.SECURITY_ANSWER);

              // Shipping details
              expect(html).toContain('Once your payment has been accepted, your order will be processed and shipped to:');
              expect(html).toContain(_order.recipient);
              expect(html).toContain(_order.street);
              expect(html).toContain(_order.city);
              expect(html).toContain(_order.province);
              expect(html).toContain(_order.country);
              expect(html).toContain(_order.postcode);
              expect(html).toContain('Reply to this email with any questions.');

              // Attachments
              const attachments = mailer.transport.sentMail[0].data.attachments;
              expect(attachments.length).toEqual(2);
              expect(attachments[0].filename).toEqual(cart.items[0].image);
              expect(attachments[0].path).toEqual(path.resolve(__dirname, '../../public/images/products', cart.items[0].image));
              expect(attachments[0].cid).toEqual(cart.items[0].image);
              expect(attachments[1].filename).toEqual(cart.items[1].image);
              expect(attachments[1].path).toEqual(path.resolve(__dirname, '../../public/images/products', cart.items[1].image));
              expect(attachments[1].cid).toEqual(cart.items[1].image);

              done();
            });
          });
        });
      });
    });
  });
});
