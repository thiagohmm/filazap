import { DomainError } from './DomainError';

export class ChannelNotFoundError extends DomainError {
  constructor(channelId: string) {
    super(`O canal "${channelId}" não foi encontrado.`);
  }
}
