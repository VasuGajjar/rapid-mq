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
    describe: 'Application Group (for pubsub)'
  })
  .option('topic', {
    alias: 't',
    type: 'string',
    describe: 'Topic name (for pubsub/rpc)'
  })
  .option('consumerTag', {
    alias: 'c',
    type: 'string',
    describe: 'Consumer Tag (for direct)'
  })
  .option('message', {
    alias: 'm',
    type: 'string',
    demandOption: true,
    describe: 'Message to send (as JSON string or plain text)'
  })
  .help()
  .argv;

async function main() {
  const connector = new RapidConnector({
    url: 'amqp://vasu_local:vasu_local@localhost:5672/vasu_local',
    appId: argv.appId,
  });
  await connector.connect();

  switch (argv.type) {
    case 'p':
      if (!argv.appGroup || !argv.topic) {
        console.error('appGroup and topic are required for pubsub');
        process.exit(1);
      }
      await pubsub(connector);
      break;
    case 'r':
      if (!argv.topic) {
        console.error('topic is required for rpc');
        process.exit(1);
      }
      await rpc(connector);
      break;
    case 'd':
      if (!argv.consumerTag) {
        console.error('consumerTag is required for direct');
        process.exit(1);
      }
      await direct(connector);
      break;
    default:
      console.error('Invalid messaging type specified');
      process.exit(1);
  }
}

async function pubsub(connector) {
  const pubsub = new PubSubMessager({ connector, appGroup: argv.appGroup });
  await pubsub.initialize();
  let msg = parseMessage(argv.message);
  console.log(`Message Status:`, await pubsub.publish(argv.topic, msg));
  console.log(`Published message to topic "${argv.topic}":`, msg);
}

async function rpc(connector) {
  const rpc = new RpcMessager({ connector, timeoutInSec: 5 });
  await rpc.initialize();
  let msg = parseMessage(argv.message);
  try {
    const response = await rpc.call(argv.topic, msg);
    console.log(`RPC response from "${argv.topic}":`, response);
  } catch (err) {
    console.error('RPC call failed:', err);
  }
}

async function direct(connector) {
  const direct = new DirectMessager({ connector, consumerTag: argv.appId });
  await direct.initialize();
  let msg = parseMessage(argv.message);
  await direct.send(argv.consumerTag, msg);
  console.log(`Sent direct message to "${argv.consumerTag}":`, msg);
}

function parseMessage(input) {
  try {
    return JSON.parse(input);
  } catch {
    return input;
  }
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

main();