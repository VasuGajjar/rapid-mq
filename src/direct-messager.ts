import * as amqp from 'amqplib';

import { RapidConnector } from "./rapid-connector";

export interface DirectMessagerOptions {
    connector: RapidConnector;
    consumerTag: string;
    exchangeName?: string;
}

export class DirectMessager {
    private _connecter: RapidConnector;
    private _exchangeName: string;
    private _consumerTag: string;
    private _channel: amqp.Channel | null = null;

    constructor(options: DirectMessagerOptions) {
        if (!options.connector) {
            throw new Error("RapidConnector is required");
        }

        if (!options.consumerTag) {
            throw new Error("Consumer tag is required");
        }

        this._connecter = options.connector;
        this._consumerTag = options.consumerTag;
        this._exchangeName = options.exchangeName || 'direct-exchange';
    }

    get connecter(): RapidConnector {
        return this._connecter;
    }

    get exchangeName(): string {
        return this._exchangeName;
    }

    get consumerTag(): string {
        return this._consumerTag;
    }

    async initialize(): Promise<void> {
        if (!this._connecter.connected) {
            await this._connecter.connect();
        }

        this._channel = await this._connecter.connection.createChannel();
        if (!this._channel) {
            throw new Error("Connection is not established");
        }

        await this._channel.assertExchange(this._exchangeName, 'direct', { durable: true });
        const queue = await this._channel.assertQueue(`${this._consumerTag}.queue`, { durable: true });
        await this._channel.bindQueue(queue.queue, this._exchangeName, queue.queue);
        await this._channel.bindQueue(queue.queue, this._exchangeName, this._consumerTag);
    }

    async send(sendTo: string, message: unknown): Promise<boolean> {
        if (!this._channel) {
            throw new Error("Channel is not initialized");
        }

        const data = Buffer.from(JSON.stringify([message]), 'utf-8');
        return this._channel.publish(this._exchangeName, sendTo, data);
    }

    async listen(callback: (message: unknown) => void): Promise<void> {
        if (!this._channel) {
            throw new Error("Channel is not initialized");
        }

        await this._channel.consume(`${this._consumerTag}.queue`, (msg) => {
            try {
                if (msg && msg.content) {
                    const message = JSON.parse(msg.content.toString('utf-8'))?.[0] || null;
                    callback(message);
                }
            } catch (error) {
                console.error("Error processing message:", error);
            }
        }, { noAck: true });
    }
}