/**
 * RpcMessager - Implements the request/response (RPC) messaging pattern for RabbitMQ.
 * Allows sending RPC calls and serving RPC methods with automatic correlation and timeout handling.
 */

import * as crypto from 'crypto';
import { EventEmitter } from 'stream';
import * as amqp from 'amqplib';

import { RapidConnector } from "./rapid-connector";

/**
 * Options for creating an RpcMessager instance.
 */
export interface RpcMessagerOptions {
    /** The RapidConnector instance to use for RabbitMQ connection. */
    connector: RapidConnector;
    /** (Optional) Name of the exchange to use for RPC. Defaults to 'rpc-exchange'. */
    exchangeName?: string;
    /** (Optional) Timeout in seconds for RPC calls. Defaults to 5 seconds. */
    timeoutInSec?: number;
    /** (Optional) EventEmitter instance for handling RPC responses. Defaults to a new EventEmitter. */
    emitter?: EventEmitter;
}

/**
 * RpcMessager provides methods to make RPC calls and serve RPC endpoints using RabbitMQ.
 */
export class RpcMessager {
    private _connecter: RapidConnector;
    private _exchangeName: string;
    private _timeoutInSec: number;
    private _channel: amqp.Channel | null = null;
    private _responseQueue: string = 'amq.rabbitmq.reply-to';
    private _emitter:EventEmitter;

    /**
     * Constructs a new RpcMessager.
     * @param options - Configuration options for the messager.
     * @throws {Error} If connector is not provided.
     */
    constructor(options: RpcMessagerOptions) {
        if (!options.connector) {
            throw new Error("RapidConnector is required");
        }

        this._connecter = options.connector;
        this._exchangeName = options.exchangeName || 'rpc-exchange';
        this._timeoutInSec = options.timeoutInSec || 5;
        this._emitter = options.emitter || new EventEmitter();
    }

    /** Returns the RapidConnector instance. */
    get connecter(): RapidConnector {
        return this._connecter;
    }

    /** Returns the exchange name used for RPC. */
    get exchangeName(): string {
        return this._exchangeName;
    }

    /**
     * Initializes the RpcMessager by creating a channel, asserting the exchange,
     * and setting up a consumer for the reply-to queue.
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

        await this._channel.assertExchange(this._exchangeName, 'direct', { durable: true });

        this._channel.consume(this._responseQueue, (result) => {
            if (result && result.properties.correlationId) {
                this._emitter.emit(
                    `rpc:${result.properties.correlationId}`,
                    JSON.parse(result.content.toString('utf-8'))?.[0] || null,
                );
            }
        }, { noAck: true });
    }

    /**
     * Makes an RPC call to a remote method.
     * @param method - The name of the remote method (routing key).
     * @param args - Arguments to pass to the remote method.
     * @returns Promise<T> - Resolves with the response from the server.
     * @throws {Error} If the channel is not initialized or if the call times out.
     */
    async call<T>(method: string, ...args: unknown[]): Promise<T> {
        if (!this._channel) {
            throw new Error("Channel is not initialized");
        }

        return new Promise<T>((resolve, reject) => {
            const requestId = crypto.randomUUID();
            const data = Buffer.from(JSON.stringify(args), 'utf-8');

            const timeout = setTimeout(() => {
                this._emitter.removeListener(`rpc:${requestId}`, responseHandler);
                reject(new Error(`RPC call to ${method} timed out after ${this._timeoutInSec} seconds`));
            }, this._timeoutInSec * 1000);

            const responseHandler = (result: unknown) => {
                clearTimeout(timeout);
                if (result) resolve(result as T);
                else reject(new Error(`No response received for RPC call to ${method}`));
            }

            this._emitter.once(`rpc:${requestId}`, responseHandler);

            this._channel!.publish(this._exchangeName, method, data, {
                replyTo: this._responseQueue,
                correlationId: requestId,
            });
        });
    }

    /**
     * Registers a server (handler) for an RPC method.
     * @param method - The name of the method to serve (routing key).
     * @param callback - The function to handle incoming RPC requests.
     * @returns Promise<void>
     * @throws {Error} If the channel is not initialized.
     */
    async server(method: string, callback: (...args: unknown[]) => Promise<unknown> | unknown): Promise<void> {
        if (!this._channel) {
            throw new Error("Channel is not initialized");
        }

        const queue = await this._channel.assertQueue(method, { durable: true });
        await this._channel.bindQueue(queue.queue, this._exchangeName, method);

        this._channel.consume(queue.queue, async (msg) => {
            try {
                if (msg !== null) {
                    const args = JSON.parse(msg.content.toString('utf-8')) || [];
                    const result = await callback(...args);

                    if (msg.properties.replyTo && msg.properties.correlationId) {
                        this._channel!.sendToQueue(
                            msg.properties.replyTo,
                            Buffer.from(JSON.stringify([result]), 'utf-8'),
                            { correlationId: msg.properties.correlationId },
                        );
                    }
                }
            } catch (error) {
                console.error(`Error processing RPC call for method ${method}:`, error);
            }
        }, { noAck: true });
    }
}