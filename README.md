<p align="center">
  <img src="assets/logo-with-text.png" alt="Rapid-MQ Logo" width="320"/>
</p>

# Rapid-MQ

**Rapid-MQ** is a simple, fast, and flexible Node.js library for integrating with RabbitMQ. It provides easy-to-use abstractions for Pub/Sub, RPC, and Direct messaging patterns, making it effortless to build scalable distributed systems.

---

## Features

- 🚀 **Easy Integration**: Minimal setup, works out-of-the-box.
- 📨 **Pub/Sub, RPC, Direct**: Unified API for common messaging patterns.
- 🛡️ **TypeScript Support**: Fully typed for safer code.
- ⚡ **Fast & Lightweight**: No unnecessary dependencies.

---

## Installation

```bash
npm install rapid-mq
```

---

## Quick Start

### Example: Pub/Sub Producer & Consumer

**Producer:**

```js
const { RapidConnector, PubSubMessager } = require('rapid-mq');

async function main() {
  const connector = new RapidConnector({
    url: 'amqp://user:pass@localhost:5672/vhost',
    appId: 'myApp',
  });
  await connector.connect();

  const pubsub = new PubSubMessager({ connector, appGroup: 'myGroup' });
  await pubsub.initialize();

  await pubsub.publish('my.topic', { hello: 'world' });
  console.log('Message published!');
}

main();
```

**Consumer:**

```js
const { RapidConnector, PubSubMessager } = require('rapid-mq');

async function main() {
  const connector = new RapidConnector({
    url: 'amqp://user:pass@localhost:5672/vhost',
    appId: 'myApp',
  });
  await connector.connect();

  const pubsub = new PubSubMessager({ connector, appGroup: 'myGroup' });
  await pubsub.initialize();

  await pubsub.subscribe('my.topic', (msg) => {
    console.log('Received:', msg);
  });
}

main();
```

---

## API Documentation

### RapidConnector

Handles connection management to RabbitMQ.

```ts
new RapidConnector(options: { url: string; appId: string })
```

- **url**: RabbitMQ connection string.
- **appId**: Unique identifier for your application.

**Methods:**
- `connect(): Promise<void>` — Establish connection.
- `disconnect(): Promise<void>` — Close connection.
- `connected: boolean` — Connection status.

---

### PubSubMessager

Implements the publish/subscribe pattern.

```ts
new PubSubMessager(options: { connector: RapidConnector; appGroup: string; exchangeName?: string })
```

- **connector**: Instance of `RapidConnector`.
- **appGroup**: Logical group for consumers.
- **exchangeName**: (optional) Custom exchange name.

**Methods:**
- `initialize(): Promise<void>` — Prepare the messager.
- `publish(topic: string, message: unknown): Promise<boolean>` — Publish a message.
- `subscribe(topic: string, callback: (msg: unknown) => void): Promise<void>` — Listen for messages.

---

### RpcMessager

Implements request/response (RPC) pattern.

```ts
new RpcMessager(options: { connector: RapidConnector; exchangeName?: string; timeoutInSec?: number })
```

- **connector**: Instance of `RapidConnector`.
- **exchangeName**: (optional) Custom exchange name.
- **timeoutInSec**: (optional) RPC timeout in seconds.

**Methods:**
- `initialize(): Promise<void>`
- `call<T>(method: string, ...args: unknown[]): Promise<T>` — Call an RPC method.
- `server(method: string, callback: (...args: unknown[]) => Promise<unknown> | unknown): Promise<void>` — Serve an RPC method.

---

### DirectMessager

Implements direct (point-to-point) messaging.

```ts
new DirectMessager(options: { connector: RapidConnector; consumerTag: string; exchangeName?: string })
```

- **connector**: Instance of `RapidConnector`.
- **consumerTag**: Unique tag for the consumer.
- **exchangeName**: (optional) Custom exchange name.

**Methods:**
- `initialize(): Promise<void>`
- `send(sendTo: string, message: unknown): Promise<boolean>` — Send a direct message.
- `listen(callback: (msg: unknown) => void): Promise<void>` — Listen for direct messages.

---

## Notes & Best Practices

- **Connection Management**: Always call `await connector.connect()` before using any messager.
- **Message Format**: All messages are serialized as JSON arrays internally; you can send any serializable object.
- **No Need to Assert Default Queues**: For RPC, you can consume from `amq.rabbitmq.reply-to` without asserting it.

---

## License

ISC © vasu_gajjar

---

<p align="center">
  <img src="assets/logo.png" alt="Rapid-MQ Logo" width="64"/>
</p>