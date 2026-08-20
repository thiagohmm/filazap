import { describe, it, expect } from 'vitest';
import { Organization } from '../Organization';

describe('Organization', () => {
  it('gera slug a partir do nome e define valores padrão', () => {
    const org = Organization.create({ id: 'org-1', name: 'Minha Empresa' });
    expect(org.slug).toBe('minha-empresa');
    expect(org.timezone).toBe('America/Sao_Paulo');
    expect(org.plan).toBe('STARTER');
    expect(org.subscriptionStatus).toBe('TRIAL');
  });

  it('preserva valores passados na criação', () => {
    const org = Organization.create({
      id: 'org-1',
      name: 'X',
      timezone: 'UTC',
      plan: 'PRO',
      subscriptionStatus: 'ACTIVE'
    });
    expect(org.timezone).toBe('UTC');
    expect(org.plan).toBe('PRO');
    expect(org.subscriptionStatus).toBe('ACTIVE');
  });
});
