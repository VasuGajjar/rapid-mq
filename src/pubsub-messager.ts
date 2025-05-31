/**
 * PubSubMessager - Implements the publish/subscribe messaging pattern for RabbitMQ.
 * Part of the rapid-mq package.
 */

import * as amqp from 'amqplib';

import { RapidConnector } from "./rapid-connector";

/**
 * Options for PubSubMessager.
 */
export interface PubSubMessagerOptions {
    /**
     * The RapidConnector instance to use for RabbitMQ connection.
     */
    connector: RapidConnector;
    /**
     * Logical group for consumers.
     */
    appGroup: string;
    /**
     * (Optional) Name of the exchange to use for publishing messages.
     * Defaults to 'pubsub-exchange'.
     */
    exchangeName?: string;
}

/**
 * PubSubMessager - A class that implements the publish/subscribe messaging pattern using RabbitMQ.
 * It allows publishing messages to a topic and subscribing to messages from a topic.
 */
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

    /**
     * Getters for the properties of PubSubMessager.
     */
    get connecter(): RapidConnector {
        return this._connecter;
    }

    /**
     * The logical group for consumers.
     */
    get appGroup(): string {
        return this._appGroup;
    }

    /**
     * The name of the exchange used for publishing messages.
     */
    get exchangeName(): string {
        return this._exchangeName;
    }

    /**
     * Prepare the messager for use by establishing a connection and creating a channel.
     * This method must be called before using the publish or subscribe methods.
     * @throws {Error} If the connection is not established.
     */
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

        const data = Buffer.from(JSON.stringify([message]), 'utf-8');
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