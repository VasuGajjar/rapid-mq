/**
 * PubSubMessager - Implements the publish/subscribe messaging pattern for RabbitMQ.
 * Part of the rapid-mq package.
 */

import * as amqp from 'amqplib';

import { Messager, MessagerOptions } from './messager';

/**
 * Options for PubSubMessager.
 */
export interface PubSubMessagerOptions extends MessagerOptions {
    /**
     * Logical group for consumers.
     */
    appGroup: string;
}

/**
 * PubSubMessager - A class that implements the publish/subscribe messaging pattern using RabbitMQ.
 * It allows publishing messages to a topic and subscribing to messages from a topic.
 */
export class PubSubMessager extends Messager {
    private _appGroup: string;
    private _channel: amqp.Channel | null = null;

    constructor(options: PubSubMessagerOptions) {
        if (!options.connector) {
            throw new Error("RapidConnector is required");
        }

        if (!options.appGroup) {
            throw new Error("App group is required");
        }

        super(options.connector, options.exchangeName || 'pubsub-exchange');
        this._appGroup = options.appGroup;
    }

    /**
     * The logical group for consumers.
     */
    get appGroup(): string {
        return this._appGroup;
    }

    /**
     * Prepare the messager for use by establishing a connection and creating a channel.
     * This method must be called before using the publish or subscribe methods.
     * @throws {Error} If the connection is not established.
     */
    async initialize(): Promise<void> {
        if (!this._connector.connected) {
            await this._connector.connect();
        }

        this._channel = await this._connector.connection.createChannel();
        if (!this._channel) {
            throw new Error("Connection is not established");
        }

        await this._channel.assertExchange(this._exchangeName, 'topic', { durable: true });
    }

    /**
     * Publish a message to a specific topic.
     * @param topic - The topic to publish the message to.
     * @param message - The message to publish. It can be any serializable object.
     * @returns {boolean} - Returns true if the message was published successfully.
     * @throws {Error} - Throws an error if the channel is not initialized or if publishing fails.
     */
    async publish(topic: string, message: unknown): Promise<boolean> {
        if (!this._channel) {
            throw new Error("Channel is not initialized");
        }

        const data = await this._connector.encoder.encode(message, this._exchangeName, topic);
        return this._channel.publish(this._exchangeName, topic, data);
    }

    /**
     * Subscribe to a topic and process incoming messages with the provided callback.
     * @param topic - The topic to subscribe to.
     * @param callback - The function to call when a message is received.
     * @returns {Promise<void>} - Resolves when the subscription is set up.
     * @throws {Error} - Throws an error if the channel is not initialized.
     */
    async subscribe(topic: string, callback: (message: unknown) => void): Promise<void> {
        if (!this._channel) {
            throw new Error("Channel is not initialized");
        }

        const queue = await this._channel.assertQueue(`${this._appGroup}.${topic}`, { durable: true });
        await this._channel.bindQueue(queue.queue, this._exchangeName, topic);
        await this._channel.bindQueue(queue.queue, this._exchangeName, `${this._appGroup}.${topic}`);

        this._channel.consume(queue.queue, async (msg) => {
            try {
                if (msg !== null) {
                    const message = await this._connector.encoder.decode(msg.content, this._exchangeName, topic);
                    await callback(message);
                }
            } catch (error) {
                console.error("Error processing message:", error);
            }
        }, { noAck: true });
    }
}