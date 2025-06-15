/**
 * RapidConnector - Handles connection management to RabbitMQ for the rapid-mq package.
 * Provides methods to connect, disconnect, and access the underlying connection.
 */

import * as amqp from 'amqplib';
import { DefaultRapidEncoder, RapidEncoder } from './rapic-encoder';

/**
 * Options for creating a RapidConnector instance.
 */
export interface RapidConnectorOptions {
    /** The RabbitMQ connection URL (e.g., amqp://user:pass@host:port/vhost) */
    url: string;
    /** Unique application identifier for this connector */
    appId: string;
    /** Optional encoder for message serialization */
    encoder?: RapidEncoder;
}

/**
 * RapidConnector provides a simple interface to manage a RabbitMQ connection.
 */
export class RapidConnector {
    private _url: string;
    private _appId: string;
    private _connection: amqp.ChannelModel | null = null;
    private _isConnected: boolean = false;
    private _encoder: RapidEncoder;

    /**
     * Constructs a new RapidConnector.
     * @param options - Configuration options for the connector.
     * @throws {Error} If url or appId is not provided.
     */
    constructor(private options: RapidConnectorOptions) {
        if (!options.url) {
            throw new Error("URL is required");
        }

        if (!options.appId) {
            throw new Error("App ID is required");
        }

        this._url = options.url;
        this._appId = options.appId;
        this._encoder = options.encoder || new DefaultRapidEncoder();
    }

    /**
     * Establishes a connection to RabbitMQ.
     * If already connected, this method does nothing.
     * @throws {Error} If the connection fails.
     */
    async connect(): Promise<void> {
        if (this._isConnected) {
            return;
        }

        try {
            this._connection = await amqp.connect(this._url);
            this._isConnected = true;
        } catch (error) {
            this._isConnected = false;
            throw error;
        }
    }

    /**
     * Closes the RabbitMQ connection if it is open.
     * If not connected, this method does nothing.
     * @throws {Error} If closing the connection fails.
     */
    async disconnect(): Promise<void> {
        if (!this._isConnected || !this._connection) {
            return;
        }

        try {
            await this._connection.close();
            this._isConnected = false;
            this._connection = null;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Returns the active RabbitMQ connection.
     * @throws {Error} If the connection is not established.
     */
    get connection(): amqp.ChannelModel {
        if (!this._isConnected || !this._connection) {
            throw new Error("Connection is not established");
        }
        return this._connection;
    }

    /**
     * Indicates whether the connector is currently connected to RabbitMQ.
     */
    get connected(): boolean {
        return this._isConnected;
    }

    /**
     * Returns the application ID associated with this connector.
     */
    get appId(): string {
        return this._appId;
    }

    get encoder(): RapidEncoder {
        return this._encoder;
    }
}