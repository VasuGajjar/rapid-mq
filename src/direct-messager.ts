/**
 * DirectMessager - A class for sending and receiving messages directly using RabbitMQ.
 * It allows sending messages to a specific consumer and listening for messages on a queue.
 */

import * as amqp from 'amqplib';

import { RapidConnector } from "./rapid-connector";

/**
 * Options for DirectMessager.
 */
export interface DirectMessagerOptions {
    /**
     * The RapidConnector instance to use for RabbitMQ connection.
     */
    connector: RapidConnector;
    /**
     * Unique consumer tag for identifying the consumer.
     */
    consumerTag: string;
    /**
     * (Optional) Name of the exchange to use for sending messages.
     * Defaults to 'direct-exchange'.
     */
    exchangeName?: string;
}

/**
 * DirectMessager - A class that implements direct messaging using RabbitMQ.
 * It allows sending messages to a specific consumer and listening for messages on a queue.
 */
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

    /**
     * Getters for the properties of DirectMessager.
     */
    get connecter(): RapidConnector {
        return this._connecter;
    }

    /**
     * The name of the exchange used for sending messages.
     */
    get exchangeName(): string {
        return this._exchangeName;
    }

    /**
     * The unique consumer tag for identifying the consumer.
     */
    get consumerTag(): string {
        return this._consumerTag;
    }

    /**
     * Prepare the messager for use by establishing a connection and creating a channel.
     * This method must be called before using the publish or subscribe methods.
     */
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

    /**
     * Send a message to a specific consumer.
     * @param sendTo - The consumer tag or queue name to send the message to.
     * @param message - The message to send.
     * @returns {boolean} - A boolean true if the message was sent successfully, false otherwise.
     * @throws {Error} - Throws an error if the channel is not initialized or if publishing fails.
     */
    async send(sendTo: string, message: unknown): Promise<boolean> {
        if (!this._channel) {
            throw new Error("Channel is not initialized");
        }

        const data = Buffer.from(JSON.stringify([message]), 'utf-8');
        return this._channel.publish(this._exchangeName, sendTo, data);
    }

    /**
     * Listen for messages on the consumer tag.
     * @param callback - A callback function that will be called with the received message.
     * @returns {Promise<void>} - A promise that resolves when the listener is set up.
     * @throws {Error} - Throws an error if the channel is not initialized.
     */
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