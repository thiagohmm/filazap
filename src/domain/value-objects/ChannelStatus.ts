export enum ChannelStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTED = 'CONNECTED',
  FAILED = 'FAILED'
}

export namespace ChannelStatus {
  export function fromString(raw: string): ChannelStatus {
    switch (raw.toUpperCase()) {
      case 'CONNECTED':
        return ChannelStatus.CONNECTED;
      case 'DISCONNECTED':
        return ChannelStatus.DISCONNECTED;
      case 'FAILED':
        return ChannelStatus.FAILED;
      default:
        throw new Error(`Status de canal inválido: ${raw}`);
    }
  }
}
