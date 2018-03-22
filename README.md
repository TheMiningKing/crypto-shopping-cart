The world's first open-source crypto-shopping cart!
===================================================

Working beta demo: [shop.theminingking.com](https://shop.theminingking.com). Now accepting real orders!

This is an experimental project in progress. The styling and basic functionality was straight-up jacked from [this fine fellow](https://github.com/gabrieleromanato/Node.js-Shopping-Cart).

I am exchanging t-shirts and stickers for Ethereum. Apart from some commercial providers, there doesn't seem to be much in the way of open-source cryptocurrency shopping carts. 

This project raises some interesting interface issues. The modest initial goal is to take an order and wait for transaction confirmation before shipping. Traditional shopping carts collect all cart and payment data before processing an order. Credit cards and banks validate the transaction. Since a customer must release the currency from a wallet interface apart from the shopping cart, the checkout experience deviates from what is now considered _normal_:

1. Place order
2. Send currency from external wallet interface
3. Submit transaction ID on shopping car interface for order verification

This is a very different conclusion to contemporary shopping cart expectations. And arguably, it necessitates trust in what should be a _trustless_ situation. That is, the customer has no recourse through banks or credit cards if the vendor is a scammer (though perhaps there's no recourse anyway).

Future work: contracts that fulfil when the post office reports _delivered_... less trust required.

# Setup

Clone and install dependencies:

```
npm install
```

# Testing

## For Docker fans

Start a MongoDB development server:

```
docker run --name dev-mongo -p 27017:27017 -d mongo
```

Once created, you can start and stop the container like this:

```
docker stop dev-mongo
docker start dev-mongo
```

## Execute

```
npm test
```

To execute a single test file, be sure to set the `NODE_ENV` variable:

```
NODE_ENV=test ./node_modules/.bin/jasmine spec/features/checkoutSpec.js
```

# Development

To start a Dockerized Mongo container, see above...

Seed database:

```
node db/seed.js
```

Start `maildev`:

```
docker run -d --name maildev -p 1080:80 -p 25:25 -p 587:587 djfarrelly/maildev
```

Run server:

```
npm start
```

# Production

Clone:

```
git clone https://github.com/TheMiningKing/crypto-shopping-cart.git
```

In the application directory:

```
cd crypto-shopping-cart
NODE_ENV=production npm install
```

Configure `.env`. E.g.:

```
#
# Your email (rigged for Gmail)
#
FROM=your@email.com
PASSWORD=secret

#
# Main store wallet
#
WALLET=0xd24def0856636050cf891befc0fa69ecf96c160b
CURRENCY=ETH

#
# Site name and URL
#
SITE_NAME=The Mining King
# Leave blank if no main page
SITE_URL=https://theminingking.com
```

The _Dockerized_ production is meant to be deployed behind an `nginx-proxy`/`lets-encrypt` combo:

```
docker-compose -f docker-compose.prod.yml up -d
```

## Seed

```
docker-compose -f docker-compose.prod.yml run --rm node node db/seed.js NODE_ENV=production
```

# Tor

Clone:

```
git clone https://github.com/TheMiningKing/crypto-shopping-cart.git
```

In the application directory:

```
cd crypto-shopping-cart
NODE_ENV=production npm install
```

Configure `.env`. The `FROM` and `PASSWORD` fields are to be set as specified below. The Tor deployment catches all outgoing order emails and makes them accessible from the host system. This is ensures that your Tor server keeps a low profile with minimal identifiable external traffic. E.g.:

```
# Don't change these
FROM=root@localhost
PASSWORD=secret

# Do change these
WALLET=0xd24def0856636050cf891befc0fa69ecf96c160b
CURRENCY=ETH
SITE_NAME=The Mining King
SITE_URL=https://theminingking.com
```

This Tor-safe composition is meant to be deployed behind a Dockerized Tor proxy. For the moment, details on how to do this can be found [here](https://libertyseeds.ca/2017/12/12/Dockerizing-Tor-to-serve-up-multiple-hidden-web-services/). Once the proxy is setup, execute the Tor deployment like this:

```
docker-compose -f docker-compose.tor.yml up -d
```

## Seed

```
docker-compose -f docker-compose.prod.yml run --rm node node db/seed.js NODE_ENV=production
```

## Retrieving orders

Orders are received, but they never leave the server when deployed in a Tor-safe fashion. All email orders are intercepted and deposited in the `mailorders` directory. I use `mutt` to manage these emails.

```
sudo apt install mutt
```

Then, from the application directory, simply execute:

```
sudo mutt -f mailorders/root
```

