/**
 * RapidEncoder Interface and Default Implementation
 * Provides methods to encode and decode messages for network transmission.
 */
export interface RapidEncoder {
    /**
     * Encodes a message to be sent over the network.
     * @param message - The message to encode.
     * @return {Promise<Buffer>} - The encoded message as a Buffer.
     */
    encode(message: unknown, exchange: string, topic: string): Promise<Buffer>;
    /**
     * Decodes a message received from the network.
     * @param data - The data to decode.
     * @return {Promise<unknown>} - The decoded message.
     */
    decode(data: Buffer, exchange: string, topic: string): Promise<unknown>;
}

/**
 * DefaultRapidEncoder provides a basic implementation of RapidEncoder.
 * It encodes messages as JSON strings and decodes them back to their original form.
 */
export class DefaultRapidEncoder implements RapidEncoder {
    async encode(message: unknown): Promise<Buffer> {
        let type: string = typeof message;
        let result;

        if (type === 'object' && message instanceof Date) {
            type = 'date';
            message = message.getTime();
        }

        result = JSON.stringify([type, message]);
        return Buffer.from(result, 'utf-8');
    }

    async decode(data: Buffer): Promise<unknown> {
        const [type, message] = JSON.parse(data.toString('utf-8'));
        switch (type) {
            case 'date':
                return new Date(message);
            default:
                return message;
        }
    }
}