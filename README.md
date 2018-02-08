crypto-shopping-cart
====================

This is an experimental project in progress. The styling and basic functionality was straight-up jacked from [this fine fellow](https://github.com/gabrieleromanato/Node.js-Shopping-Cart).

I want to exchange t-shirts and stickers for Ethereum. Apart from some commercial providers, there doesn't seem to be much in the way of open-source cryptocurrency shopping carts. 

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

# Development

To start a Dockerized Mongo container, see above...

Seed database:

```
node db/seed.js
```

Run server:

```
npm start
```


