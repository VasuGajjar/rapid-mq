/**
 * RpcMessager - Implements the request/response (RPC) messaging pattern for RabbitMQ.
 * Allows sending RPC calls and serving RPC methods with automatic correlation and timeout handling.
 */

import * as crypto from 'crypto';
import { EventEmitter } from 'stream';
import * as amqp from 'amqplib';

import { Messager, MessagerOptions } from './messager';

/**
 * Options for creating an RpcMessager instance.
 */
export interface RpcMessagerOptions extends MessagerOptions {
    /** (Optional) Timeout in seconds for RPC calls. Defaults to 5 seconds. */
    timeoutInSec?: number;
    /** (Optional) EventEmitter instance for handling RPC responses. Defaults to a new EventEmitter. */
    emitter?: EventEmitter;
}

/**
 * RpcMessager provides methods to make RPC calls and serve RPC endpoints using RabbitMQ.
 */
export class RpcMessager extends Messager {
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

        super(
            options.connector,
            options.exchangeName || 'rpc-exchange',
            options.durable ?? true,
            options.exclusive ?? false,
        );
        this._timeoutInSec = options.timeoutInSec || 5;
        this._emitter = options.emitter || new EventEmitter();
    }

    /**
     * Initializes the RpcMessager by creating a channel, asserting the exchange,
     * and setting up a consumer for the reply-to queue.
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

        await this._channel.assertExchange(this._exchangeName, 'direct', { durable: this._durable });

        this._channel.consume(this._responseQueue, (result) => {
            if (result && result.properties.correlationId) {
                this._emitter.emit(
                    `rpc:${result.properties.correlationId}`,
                    result.content,
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

        return new Promise<T>(async (resolve, reject) => {
            const requestId = crypto.randomUUID();
            const data = await this._connector.encoder.encode(args, this._exchangeName, method);

            const timeout = setTimeout(() => {
                this._emitter.removeListener(`rpc:${requestId}`, responseHandler);
                reject(new Error(`RPC call to ${method} timed out after ${this._timeoutInSec} seconds`));
            }, this._timeoutInSec * 1000);

            const responseHandler = async (result: Buffer) => {
                clearTimeout(timeout);
                if (result) {
                    const data = await this._connector.encoder.decode(result, this._exchangeName, method);
                    resolve(data as T);
                }
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

        const queue = await this._channel.assertQueue(method, { durable: this._durable, exclusive: this._exclusive });
        await this._channel.bindQueue(queue.queue, this._exchangeName, method);

        this._channel.consume(queue.queue, async (msg) => {
            try {
                if (msg !== null) {
                    const args = await this._connector.encoder.decode(msg.content, this._exchangeName, method) as unknown[];
                    const result = await callback(...args);

                    if (msg.properties.replyTo && msg.properties.correlationId) {
                        this._channel!.sendToQueue(
                            msg.properties.replyTo,
                            await this._connector.encoder.encode(result, this._exchangeName, method),
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