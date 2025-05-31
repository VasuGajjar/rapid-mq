const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const {
  RapidConnector,
  PubSubMessager,
  RpcMessager,
  DirectMessager,
} = require('rapid-mq');

const argv = yargs(hideBin(process.argv))
  .option('type', {
    alias: 'p',
    type: 'string',
    choices: ['p', 'r', 'd'],
    demandOption: true,
    describe: 'Type of messaging to use (pubsub, rpc, direct)',
  })
  .option('appId', {
    alias: 'i',
    type: 'string',
    demandOption: true,
    describe: 'Application ID'
  })
  .option('appGroup', {
    alias: 'g',
    type: 'string',
    describe: 'Application Group'
  })
  .option('topic', {
    alias: 't',
    type: 'string',
    describe: 'Topic name'
  })
  .option('consumerTag', {
    alias: 'c',
    type: 'string',
    describe: 'Consumer Tag'
  })
  .help()
  .argv;

async function main() {
  console.log('Starting RapidMQ Connector...');
  const connector = new RapidConnector({
    url: 'amqp://vasu_local:vasu_local@localhost:5672/vasu_local',
    appId: argv.appId,
  });
  await connector.connect();
  console.log('Connected to RabbitMQ');

  switch (argv.type) {
    case 'p':
      if (!argv.appGroup || !argv.topic) {
        console.error('appGroup and topic are required for pubsub');
        process.exit(1);
      }
      console.log('Using PubSub messaging');
      await pubsub(connector);
      break;
    case 'r':
      if (!argv.topic) {
        console.error('topic is required for rpc');
        process.exit(1);
      }
      console.log('Using RPC messaging');
      await rpc(connector);
      break;
    case 'd':
      if (!argv.consumerTag) {
        console.error('consumerTag is required for direct');
        process.exit(1);
      }
      console.log('Using Direct messaging');
      await direct(connector);
      break;
    default:
      console.error('Invalid messaging type specified');
      process.exit(1);
  }
}

async function pubsub(connector) {
  console.log('Starting PubSub Messager...');
  const pubsub = new PubSubMessager({ connector, appGroup: argv.appGroup });
  await pubsub.initialize();
  console.log('PubSub Messager initialized');

  pubsub.subscribe(argv.topic, (message) => {
    console.log('Received message:', message);
  });
  console.log(`Subscribed to topic: ${argv.topic}`);
}

async function rpc(connector) {
  console.log('Starting RPC Messager...');
  const rpc = new RpcMessager({ connector, timeoutInSec: 5 });
  await rpc.initialize();
  console.log('RPC Messager initialized');
  
  rpc.server(argv.topic, (message) => {
    console.log('Received RPC message:', message);
    // Process the message and send a response if needed
    return { status: 'success', data: 'Response data' };
  });
  console.log(`Serving RPC method: ${argv.topic}`);
}

async function direct(connector) {
  console.log('Starting Direct Messager...');
  const direct = new DirectMessager({ connector, consumerTag: argv.consumerTag });
  await direct.initialize();
  console.log('Direct Messager initialized');

  direct.listen((message) => {
    console.log('Received direct message:', message);
  });
  console.log(`Subscribed to consumer tag: ${argv.consumerTag}`);
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

main();