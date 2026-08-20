import { describe, it, expect } from 'vitest';
import { Slug } from '../Slug';
import { Email } from '../Email';
import { Role } from '../Role';
import { PhoneNumberE164 } from '../PhoneNumberE164';
import { MessageDirection } from '../MessageDirection';
import { ChannelStatus } from '../ChannelStatus';
import { WebhookEventStatus } from '../WebhookEventStatus';
import { InvalidSlugError } from '../../errors/InvalidSlugError';
import { InvalidEmailError } from '../../errors/InvalidEmailError';
import { InvalidRoleError } from '../../errors/InvalidRoleError';
import { InvalidPhoneNumberError } from '../../errors/InvalidPhoneNumberError';

describe('Slug', () => {
  it('normaliza e valida um slug válido', () => {
    expect(Slug.create('minha-empresa').value).toBe('minha-empresa');
    expect(Slug.createFromName('  Minha Empresa Ltda  ').value).toBe(
      'minha-empresa-ltda'
    );
  });

  it('normaliza acentos', () => {
    expect(Slug.createFromName('Café & Bar').value).toBe('cafe-bar');
  });

  it('rejeita slug com caracteres inválidos', () => {
    expect(() => Slug.create('Empresa!')).toThrow(InvalidSlugError);
  });
});

describe('Email', () => {
  it('valida e normaliza e-mail', () => {
    expect(Email.create('  User@Example.COM ').value).toBe('user@example.com');
  });

  it('rejeita e-mail inválido', () => {
    expect(() => Email.create('invalido')).toThrow(InvalidEmailError);
  });
});

describe('Role', () => {
  it('converte string para Role', () => {
    expect(Role.fromString('agent')).toBe(Role.AGENT);
  });

  it('rejeita papel inválido', () => {
    expect(() => Role.fromString('SUPER')).toThrow(InvalidRoleError);
  });

  it('apenas OWNER/ADMIN gerenciam membros', () => {
    expect(Role.canManageMembers(Role.OWNER)).toBe(true);
    expect(Role.canManageMembers(Role.ADMIN)).toBe(true);
    expect(Role.canManageMembers(Role.AGENT)).toBe(false);
    expect(Role.canManageMembers(Role.VIEWER)).toBe(false);
  });

  it('apenas VIEWER não pode enviar mensagens', () => {
    expect(Role.canSendMessages(Role.OWNER)).toBe(true);
    expect(Role.canSendMessages(Role.AGENT)).toBe(true);
    expect(Role.canSendMessages(Role.VIEWER)).toBe(false);
  });
});

describe('PhoneNumberE164', () => {
  it('normaliza para E.164 com +', () => {
    expect(PhoneNumberE164.create('5511999990001').e164).toBe('+5511999990001');
    expect(PhoneNumberE164.create('+55 11 99999-0001').e164).toBe('+5511999990001');
  });

  it('rejeita número inválido', () => {
    expect(() => PhoneNumberE164.create('abc')).toThrow(InvalidPhoneNumberError);
  });
});

describe('MessageDirection', () => {
  it('converte string', () => {
    expect(MessageDirection.fromString('inbound')).toBe(MessageDirection.INBOUND);
    expect(MessageDirection.fromString('OUTBOUND')).toBe(MessageDirection.OUTBOUND);
  });
});

describe('ChannelStatus', () => {
  it('converte string', () => {
    expect(ChannelStatus.fromString('connected')).toBe(ChannelStatus.CONNECTED);
    expect(ChannelStatus.fromString('FAILED')).toBe(ChannelStatus.FAILED);
  });
});

describe('WebhookEventStatus', () => {
  it('converte string', () => {
    expect(WebhookEventStatus.fromString('pending')).toBe(WebhookEventStatus.PENDING);
    expect(WebhookEventStatus.fromString('PROCESSED')).toBe(WebhookEventStatus.PROCESSED);
  });
});
