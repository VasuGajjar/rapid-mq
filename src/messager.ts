import { RapidConnector } from "./rapid-connector";

export interface MessagerOptions {
    /** The RapidConnector instance to use for RabbitMQ connection */
    connector: RapidConnector;

    /** (Optional) Name of the exchange to use for messaging */
    exchangeName?: string;
}

export class Messager {
    constructor(
        protected _connector: RapidConnector,
        protected _exchangeName: string
    ) {}

    public get connector(): RapidConnector {
        return this._connector;
    }

    public get exchangeName(): string {
        return this._exchangeName;
    }
}