import * as amqp from 'amqplib';

import { RapidConnector } from "./rapid-connector";

export interface PubSubMessagerOptions {
    connector: RapidConnector;
    appGroup: string;
    exchangeName?: string;
}

export class PubSubMessager {
    private _connecter: RapidConnector;
    private _appGroup: string;
    private _exchangeName: string;
    private _channel: amqp.Channel | null = null;

    constructor(options: PubSubMessagerOptions) {
        if (!options.connector) {
            throw new Error("RapidConnector is required");
        }

        if (!options.appGroup) {
            throw new Error("App group is required");
        }

        this._connecter = options.connector;
        this._appGroup = options.appGroup;
        this._exchangeName = options.exchangeName || 'pubsub-exchange';
    }

    get connecter(): RapidConnector {
        return this._connecter;
    }

    get appGroup(): string {
        return this._appGroup;
    }

    get exchangeName(): string {
        return this._exchangeName;
    }

    async initialize(): Promise<void> {
        if (!this._connecter.connected) {
            await this._connecter.connect();
        }

        this._channel = await this._connecter.connection.createChannel();
        if (!this._channel) {
            throw new Error("Connection is not established");
        }

        await this._channel.assertExchange(this._exchangeName, 'topic', { durable: true });
    }

    async publish(topic: string, message: unknown): Promise<boolean> {
        if (!this._channel) {
            throw new Error("Channel is not initialized");
        }

        const data = Buffer.from(JSON.stringify([message]), 'utf-8');
        return this._channel.publish(this._exchangeName, topic, data);
    }

    async subscribe(topic: string, callback: (message: unknown) => void): Promise<void> {
        if (!this._channel) {
            throw new Error("Channel is not initialized");
        }

        const queue = await this._channel.assertQueue(`${this._appGroup}.${topic}`, { durable: true });
        await this._channel.bindQueue(queue.queue, this._exchangeName, topic);
        await this._channel.bindQueue(queue.queue, this._exchangeName, `${this._appGroup}.${topic}`);

        this._channel.consume(queue.queue, (msg) => {
            try {
                if (msg !== null) {
                    callback(JSON.parse(msg.content.toString('utf-8'))?.[0]);
                }
            } catch (error) {
                console.error("Error processing message:", error);
            }
        }, { noAck: true });
    }
}