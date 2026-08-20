export enum MessageDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND'
}

export namespace MessageDirection {
  export function fromString(raw: string): MessageDirection {
    switch (raw.toUpperCase()) {
      case 'INBOUND':
        return MessageDirection.INBOUND;
      case 'OUTBOUND':
        return MessageDirection.OUTBOUND;
      default:
        throw new Error(`Direção de mensagem inválida: ${raw}`);
    }
  }
}
