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

## Quick Start Examples

### 1. Publisher/Subscriber Pattern

Use `PubSubMessager` for broadcast-style messaging where multiple consumers can receive the same message.

**Publisher Example:**
```typescript
import { RapidConnector, PubSubMessager } from 'rapid-mq';

async function main() {
  const connector = new RapidConnector({
    url: 'amqp://localhost',
    appId: 'publisher-service'
  });
  await connector.connect();

  const pubsub = new PubSubMessager({
    connector,
    appGroup: 'notifications', // Logical grouping
    exchangeName: 'events' // Optional custom exchange
  });
  await pubsub.initialize();

  await pubsub.publish('user.created', {
    userId: '123',
    email: 'user@example.com'
  });
}

main();
```

**Subscriber Example:**
```typescript
import { RapidConnector, PubSubMessager } from 'rapid-mq';

async function main() {
  const connector = new RapidConnector({
    url: 'amqp://localhost',
    appId: 'email-service'
  });
  await connector.connect();

  const pubsub = new PubSubMessager({
    connector,
    appGroup: 'notifications'
  });
  await pubsub.initialize();

  await pubsub.subscribe('user.created', (message) => {
    console.log('New user:', message);
  });
}

main();
```

---

### 2. RPC (Remote Procedure Call) Pattern

Use `RpcMessager` for request-response style communication.

**Server Example:**
```typescript
import { RapidConnector, RpcMessager } from 'rapid-mq';

async function main() {
  const connector = new RapidConnector({
    url: 'amqp://localhost',
    appId: 'math-service'
  });
  await connector.connect();

  const rpc = new RpcMessager({
    connector,
    exchangeName: 'math', // Optional
    timeoutInSec: 30 // Default: 5 seconds
  });
  await rpc.initialize();

  await rpc.server('add', async (a: number, b: number) => {
    return a + b;
  });
}

main();
```

**Client Example:**
```typescript
import { RapidConnector, RpcMessager } from 'rapid-mq';

async function main() {
  const connector = new RapidConnector({
    url: 'amqp://localhost',
    appId: 'calculator-app'
  });
  await connector.connect();

  const rpc = new RpcMessager({ connector });
  await rpc.initialize();

  const result = await rpc.call<number>('add', 5, 3);
  console.log('5 + 3 =', result); // Output: 8
}

main();
```

---

### 3. Direct Messaging Pattern

Use `DirectMessager` for point-to-point communication where each message should be processed by exactly one consumer.

**Sender Example:**
```typescript
import { RapidConnector, DirectMessager } from 'rapid-mq';

async function main() {
  const connector = new RapidConnector({
    url: 'amqp://localhost',
    appId: 'order-service'
  });
  await connector.connect();

  const direct = new DirectMessager({
    connector,
    consumerTag: 'order-service-1',
    exchangeName: 'orders' // Optional
  });
  await direct.initialize();

  await direct.send('payment-service', {
    orderId: '12345',
    amount: 99.99
  });
}

main();
```

**Receiver Example:**
```typescript
import { RapidConnector, DirectMessager } from 'rapid-mq';

async function main() {
  const connector = new RapidConnector({
    url: 'amqp://localhost',
    appId: 'payment-service'
  });
  await connector.connect();

  const direct = new DirectMessager({
    connector,
    consumerTag: 'payment-service'
  });
  await direct.initialize();

  await direct.listen((message) => {
    console.log('Processing payment:', message);
  });
}

main();
```

---

## API Reference

### RapidConnector

Manages the connection to RabbitMQ.

**Constructor:**
```typescript
new RapidConnector(options: {
  url: string;
  appId: string;
  encoder?: RapidEncoder; // Optional custom encoder
})
```

**Properties:**
- `url: string` - RabbitMQ connection URL.
- `appId: string` - Unique identifier for your application.
- `connected: boolean` - Current connection status.
- `encoder: RapidEncoder` - Encoder used for message serialization.

**Methods:**
- `connect(): Promise<void>` - Establish connection to RabbitMQ.
- `disconnect(): Promise<void>` - Close connection gracefully.
- `connection` (getter) - Returns the underlying amqplib connection.

---

### PubSubMessager

Implements the publish/subscribe messaging pattern.

**Constructor:**
```typescript
new PubSubMessager(options: {
  connector: RapidConnector;
  appGroup: string;
  exchangeName?: string;
  durable?: boolean;
  exclusive?: boolean;
})
```

**Properties:**
- `connector: RapidConnector` - Connection instance.
- `appGroup: string` - Logical group name for consumers.
- `exchangeName: string` - Exchange name (default: 'pubsub-exchange').
- `durable: boolean` - Whether the exchange/queue is durable (default: true).
- `exclusive: boolean` - Whether the queue is exclusive (default: false).

**Methods:**
- `initialize(): Promise<void>` - Set up exchanges and queues.
- `publish(topic: string, message: any): Promise<boolean>` - Publish message to topic.
- `subscribe(topic: string, callback: (msg: any) => void): Promise<void>` - Subscribe to topic.

---

### RpcMessager

Implements the request/response (RPC) messaging pattern.

**Constructor:**
```typescript
new RpcMessager(options: {
  connector: RapidConnector;
  exchangeName?: string;
  timeoutInSec?: number;
  durable?: boolean;
  exclusive?: boolean;
  emitter?: EventEmitter;
})
```

**Properties:**
- `connector: RapidConnector` - Connection instance.
- `exchangeName: string` - Exchange name (default: 'rpc-exchange').
- `timeoutInSec: number` - RPC timeout in seconds (default: 5).
- `durable: boolean` - Whether the exchange/queue is durable (default: true).
- `exclusive: boolean` - Whether the queue is exclusive (default: false).

**Methods:**
- `initialize(): Promise<void>` - Set up RPC infrastructure.
- `call<T>(method: string, ...args: any[]): Promise<T>` - Call remote method.
- `server(method: string, handler: Function): Promise<void>` - Register RPC handler.

---

### DirectMessager

Implements point-to-point (direct) messaging.

**Constructor:**
```typescript
new DirectMessager(options: {
  connector: RapidConnector;
  consumerTag: string;
  exchangeName?: string;
  durable?: boolean;
  exclusive?: boolean;
})
```

**Properties:**
- `connector: RapidConnector` - Connection instance.
- `consumerTag: string` - Unique identifier for consumer.
- `exchangeName: string` - Exchange name (default: 'direct-exchange').
- `durable: boolean` - Whether the exchange/queue is durable (default: true).
- `exclusive: boolean` - Whether the queue is exclusive (default: false).

**Methods:**
- `initialize(): Promise<void>` - Set up direct exchange and queue.
- `send(to: string, message: any): Promise<boolean>` - Send message to specific consumer.
- `listen(callback: (msg: any) => void): Promise<void>` - Listen for messages.

---

## Encoder System

Rapid-MQ uses an encoder system to serialize and deserialize messages. By default, it uses JSON, but you can provide your own encoder by implementing the `RapidEncoder` interface.

**Default Encoder:**
- Encodes messages as `[type, value]` JSON arrays.
- Handles special types like `Date`.

**Custom Encoder Example:**
```typescript
import { RapidEncoder } from 'rapid-mq';

class MyEncoder implements RapidEncoder {
  async encode(message: unknown): Promise<Buffer> {
    // Custom serialization logic
    return Buffer.from(JSON.stringify(message));
  }
  async decode(data: Buffer): Promise<unknown> {
    // Custom deserialization logic
    return JSON.parse(data.toString());
  }
}

const connector = new RapidConnector({
  url: 'amqp://localhost',
  appId: 'my-app',
  encoder: new MyEncoder()
});
```

**RapidEncoder Interface:**
```typescript
interface RapidEncoder {
  encode(message: unknown, exchange: string, topic: string): Promise<Buffer>;
  decode(data: Buffer, exchange: string, topic: string): Promise<unknown>;
}
```

---

## Best Practices

- **Always call `initialize()`** on messager instances before using them.
- **Handle errors** in your callbacks and publishing logic.
- **Disconnect** your connector when your app shuts down.

---

## License

ISC © vasu_gajjar

<p align="center">
  <img src="assets/logo.png" alt="Rapid-MQ Logo" width="64"/>