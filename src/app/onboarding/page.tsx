'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { saveSession } from '../lib/session';

export default function OnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    adminName: '',
    adminEmail: '',
    adminPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Erro ao criar a empresa.');
        return;
      }
      saveSession({
        token: data.token,
        user: data.user,
        organizations: [
          { id: data.organizationId, name: data.name, slug: data.slug, role: 'OWNER' }
        ]
      });
      router.push('/dashboard');
    } catch {
      setError('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-box card">
        <h1 className="auth-title">Criar sua empresa</h1>
        <p className="auth-sub">Comece sua central de atendimento</p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="name">Nome da empresa</label>
            <input
              id="name"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="adminName">Seu nome</label>
            <input
              id="adminName"
              value={form.adminName}
              onChange={(e) => update('adminName', e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="adminEmail">Seu e-mail</label>
            <input
              id="adminEmail"
              type="email"
              value={form.adminEmail}
              onChange={(e) => update('adminEmail', e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="adminPassword">Senha</label>
            <input
              id="adminPassword"
              type="password"
              value={form.adminPassword}
              onChange={(e) => update('adminPassword', e.target.value)}
              minLength={8}
              required
            />
          </div>
          {error && <div className="form-error">{error}</div>}
          <button type="submit" className="btn btn-block" disabled={loading}>
            {loading ? 'Criando...' : 'Criar empresa'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 16 }}>
          Já tem conta? <Link href="/login">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
