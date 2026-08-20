'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Building2, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { saveSession } from '../lib/session';
import AuthBrand from '../components/AuthBrand';

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
    <main className="auth-layout">
      <AuthBrand />
      <section className="auth-form-panel onboarding-panel">
        <div className="auth-box">
          <div className="auth-mobile-logo">FilaZap</div>
          <span className="eyebrow">Comece agora</span>
          <h1 className="auth-title">Crie seu workspace</h1>
          <p className="auth-sub">Configure sua empresa e centralize o atendimento em poucos minutos.</p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="name">Nome da empresa</label>
            <div className="input-icon"><Building2 size={17} /><input
              id="name"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="Ex.: Empresa Exemplo"
              required
            /></div>
          </div>
          <div className="field">
            <label htmlFor="adminName">Seu nome</label>
            <div className="input-icon"><UserRound size={17} /><input
              id="adminName"
              value={form.adminName}
              onChange={(e) => update('adminName', e.target.value)}
              placeholder="Nome completo"
              required
            /></div>
          </div>
          <div className="field">
            <label htmlFor="adminEmail">Seu e-mail</label>
            <div className="input-icon"><Mail size={17} /><input
              id="adminEmail"
              type="email"
              value={form.adminEmail}
              onChange={(e) => update('adminEmail', e.target.value)}
              placeholder="voce@empresa.com"
              required
            /></div>
          </div>
          <div className="field">
            <label htmlFor="adminPassword">Senha</label>
            <div className="input-icon"><LockKeyhole size={17} /><input
              id="adminPassword"
              type="password"
              value={form.adminPassword}
              onChange={(e) => update('adminPassword', e.target.value)}
              placeholder="Mínimo de 8 caracteres"
              minLength={8}
              required
            /></div>
          </div>
          {error && <div className="alert alert-error auth-alert">{error}</div>}
          <button type="submit" className="btn btn-block" disabled={loading}>
            {loading ? <><span className="button-spinner" />Criando...</> : <>Criar workspace <ArrowRight size={17} /></>}
          </button>
        </form>
          <p className="auth-switch">Já possui uma conta? <Link href="/login">Entrar na plataforma</Link></p>
        </div>
      </section>
    </main>
  );
}
