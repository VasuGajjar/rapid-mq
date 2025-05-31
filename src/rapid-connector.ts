import * as amqp from 'amqplib';

export interface RapidConnectorOptions {
    url: string;
    appId: string;
}

export class RapidConnector {
    private _url: string;
    private _appId: string;
    private _connection: amqp.ChannelModel | null = null;
    private _isConnected: boolean = false;

    constructor(private options: RapidConnectorOptions) {
        if (!options.url) {
            throw new Error("URL is required");
        }

        if (!options.appId) {
            throw new Error("App ID is required");
        }

        this._url = options.url;
        this._appId = options.appId;
    }

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

    get connection(): amqp.ChannelModel {
        if (!this._isConnected || !this._connection) {
            throw new Error("Connection is not established");
        }
        return this._connection;
    }

    get connected(): boolean {
        return this._isConnected;
    }

    get appId(): string {
        return this._appId;
    }
}