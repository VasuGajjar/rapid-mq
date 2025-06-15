import { RapidConnector } from "./rapid-connector";

export interface MessagerOptions {
    /** The RapidConnector instance to use for RabbitMQ connection */
    connector: RapidConnector;

    /** (Optional) Name of the exchange to use for messaging */
    exchangeName?: string;

    /** (Optional) Name of the queue to use for messaging */
    durable?: boolean;

    /** (Optional) Whether the queue should be durable */
    exclusive?: boolean;
}

export class Messager {
    constructor(
        protected _connector: RapidConnector,
        protected _exchangeName: string,
        protected _durable: boolean,
        protected _exclusive: boolean,
    ) {}

    public get connector(): RapidConnector {
        return this._connector;
    }

    public get exchangeName(): string {
        return this._exchangeName;
    }
}