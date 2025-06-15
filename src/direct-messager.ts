/**
 * DirectMessager - A class for sending and receiving messages directly using RabbitMQ.
 * It allows sending messages to a specific consumer and listening for messages on a queue.
 */

import * as amqp from 'amqplib';

import { Messager, MessagerOptions } from './messager';

/**
 * Options for DirectMessager.
 */
export interface DirectMessagerOptions extends MessagerOptions {
    /** Unique consumer tag for identifying the consumer. */
    consumerTag: string;
}

/**
 * DirectMessager - A class that implements direct messaging using RabbitMQ.
 * It allows sending messages to a specific consumer and listening for messages on a queue.
 */
export class DirectMessager extends Messager {
    private _consumerTag: string;
    private _channel: amqp.Channel | null = null;

    constructor(options: DirectMessagerOptions) {
        if (!options.connector) {
            throw new Error("RapidConnector is required");
        }
        
        if (!options.consumerTag) {
            throw new Error("Consumer tag is required");
        }
        
        super(options.connector, options.exchangeName || 'direct-exchange');
        this._consumerTag = options.consumerTag;
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
        if (!this._connector.connected) {
            await this._connector.connect();
        }

        this._channel = await this._connector.connection.createChannel();
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

        const data = await this._connector.encoder.encode(message, this._exchangeName, sendTo);
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

        await this._channel.consume(`${this._consumerTag}.queue`, async (msg) => {
            try {
                if (msg && msg.content) {
                    const message = await this._connector.encoder.decode(msg.content, this._exchangeName, this._consumerTag);
                    await callback(message);
                }
            } catch (error) {
                console.error("Error processing message:", error);
            }
        }, { noAck: true });
    }
}