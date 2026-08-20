import { DomainError } from './DomainError';

export class ChannelNotConfiguredError extends DomainError {
  constructor(channelId: string) {
    super(`O canal "${channelId}" ainda não tem credenciais do WhatsApp configuradas.`);
  }
}
