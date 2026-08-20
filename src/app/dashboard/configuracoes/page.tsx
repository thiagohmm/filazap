'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { KeyRound, MessageCircleMore, Palette, Settings2 } from 'lucide-react';
import { loadSession, saveSession } from '../../lib/session';
import type { OrganizationInfo } from '../../lib/session';
import { useOrgTheme } from '../../lib/useOrgTheme';
import Topbar from '../components/Topbar';

type Channel = {
  id: string;
  phoneNumberId: string;
  businessAccountId: string;
  displayPhoneNumber: string;
  status: string;
  configured: boolean;
  createdAt: string;
};

const THEME_OPTIONS = [
  { value: 'light', label: 'Claro', icon: '☀️' },
  { value: 'dark', label: 'Escuro', icon: '🌙' }
] as const;

const BRAND_COLORS = [
  '#10b981',
  '#25d366',
  '#3b82f6',
  '#8b5cf6',
  '#f97316',
  '#ec4899'
];

export default function ConfiguracoesPage() {
  const router = useRouter();
  const [session, setSession] = useState(loadSession);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationInfo | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState('');

  const [channelForm, setChannelForm] = useState({
    phoneNumberId: '',
    businessAccountId: '',
    displayPhoneNumber: ''
  });

  const [credForm, setCredForm] = useState({
    accessToken: '',
    appSecret: '',
    webhookVerifyToken: '',
    apiBaseUrl: ''
  });

  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [brandColor, setBrandColor] = useState('#10b981');

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useOrgTheme(selectedOrg);

  const canManage = selectedOrg?.role === 'OWNER' || selectedOrg?.role === 'ADMIN';

  useEffect(() => {
    if (!session) {
      router.replace('/login');
      return;
    }
    if (!selectedOrg && session.organizations.length > 0) {
      setSelectedOrg(session.organizations[0]);
    }
  }, [session, selectedOrg, router]);

  useEffect(() => {
    if (!selectedOrg) return;
    setTheme(selectedOrg.theme === 'dark' ? 'dark' : 'light');
    setBrandColor(selectedOrg.brandColor ?? '#10b981');
  }, [selectedOrg]);

  useEffect(() => {
    if (!session || !selectedOrg) return;
    setError('');
    fetch(`/api/organizations/${selectedOrg.id}/channels`, {
      headers: { Authorization: `Bearer ${session.token}` }
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.channels) {
          setChannels(data.channels);
          setSelectedChannelId((prev) => prev || data.channels[0]?.id || '');
        } else {
          setError(data.error ?? 'Erro ao carregar canais.');
        }
      })
      .catch(() => setError('Erro de conexão.'));
  }, [session, selectedOrg]);

  function selectOrg(orgId: string) {
    if (!session) return;
    const org = session.organizations.find((o) => o.id === orgId);
    if (org) setSelectedOrg(org);
  }

  function updateSessionOrg(updated: { theme: string; brandColor: string }) {
    if (!session || !selectedOrg) return;
    const organizations = session.organizations.map((o) =>
      o.id === selectedOrg.id ? { ...o, ...updated } : o
    );
    const next = { ...session, organizations };
    setSession(next);
    saveSession(next);
    setSelectedOrg(organizations.find((o) => o.id === selectedOrg.id) ?? null);
  }

  async function handleRegisterChannel(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !selectedOrg) return;
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/organizations/${selectedOrg.id}/channels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify(channelForm)
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Erro ao registrar número.');
        return;
      }
      setNotice(`Número ${data.channel.displayPhoneNumber} registrado.`);
      setChannelForm({ phoneNumberId: '', businessAccountId: '', displayPhoneNumber: '' });
      setSelectedChannelId(data.channel.id);
      const updated = await fetch(`/api/organizations/${selectedOrg.id}/channels`, {
        headers: { Authorization: `Bearer ${session.token}` }
      }).then((r) => r.json());
      if (updated.channels) setChannels(updated.channels);
    } catch {
      setError('Erro de conexão.');
    }
  }

  async function handleSaveCredentials(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !selectedOrg || !selectedChannelId) return;
    setError('');
    setNotice('');
    const body: Record<string, string> = {};
    if (credForm.accessToken) body.accessToken = credForm.accessToken;
    if (credForm.appSecret) body.appSecret = credForm.appSecret;
    if (credForm.webhookVerifyToken) body.webhookVerifyToken = credForm.webhookVerifyToken;
    if (credForm.apiBaseUrl !== '') body.apiBaseUrl = credForm.apiBaseUrl;
    try {
      const res = await fetch(
        `/api/organizations/${selectedOrg.id}/channels/${selectedChannelId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.token}`
          },
          body: JSON.stringify(body)
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Erro ao salvar credenciais.');
        return;
      }
      setNotice('Credenciais salvas.');
      setCredForm({ accessToken: '', appSecret: '', webhookVerifyToken: '', apiBaseUrl: '' });
      const updated = await fetch(`/api/organizations/${selectedOrg.id}/channels`, {
        headers: { Authorization: `Bearer ${session.token}` }
      }).then((r) => r.json());
      if (updated.channels) setChannels(updated.channels);
    } catch {
      setError('Erro de conexão.');
    }
  }

  async function handleSaveAppearance(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !selectedOrg) return;
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/organizations/${selectedOrg.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify({ theme, brandColor })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Erro ao salvar aparência.');
        return;
      }
      setNotice('Aparência salva.');
      updateSessionOrg({
        theme: data.organization.theme,
        brandColor: data.organization.brandColor
      });
    } catch {
      setError('Erro de conexão.');
    }
  }

  if (!session || !selectedOrg) {
    return <div className="loading-screen"><span className="spinner" />Carregando workspace...</div>;
  }

  const selectedChannel = channels.find((c) => c.id === selectedChannelId);

  return (
    <div>
      <Topbar session={session} selectedOrg={selectedOrg} onSelectOrg={selectOrg} />

      <main className="dash page-content">
        <div className="page-head page-head-row">
          <div>
          <span className="eyebrow">Administração</span>
          <h1>Configurações</h1>
          <p>Gerencie os números de WhatsApp e a aparência de {selectedOrg.name}.</p>
          </div>
          <div className="head-stat"><Settings2 size={20} /><span><strong>{channels.length}</strong> canal(is)</span></div>
        </div>

        {notice && <div className="alert alert-success">{notice}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <div className="settings-grid">
          <div>
            <div className="card settings-card">
              <div className="card-head">
                <div className="card-icon"><MessageCircleMore size={20} /></div>
                <div>
                  <h3>Adicionar número</h3>
                  <p className="card-sub">
                    Registre o número do WhatsApp Business que será atendido nesta conta.
                  </p>
                </div>
              </div>
              <form onSubmit={handleRegisterChannel}>
                <div className="field">
                  <label>Phone Number ID</label>
                  <input
                    value={channelForm.phoneNumberId}
                    onChange={(e) => setChannelForm((f) => ({ ...f, phoneNumberId: e.target.value }))}
                    placeholder="Ex.: 123456789012345"
                    required
                  />
                </div>
                <div className="field">
                  <label>Business Account ID</label>
                  <input
                    value={channelForm.businessAccountId}
                    onChange={(e) => setChannelForm((f) => ({ ...f, businessAccountId: e.target.value }))}
                    placeholder="Ex.: 987654321098765"
                    required
                  />
                </div>
                <div className="field">
                  <label>Número de exibição</label>
                  <input
                    value={channelForm.displayPhoneNumber}
                    onChange={(e) => setChannelForm((f) => ({ ...f, displayPhoneNumber: e.target.value }))}
                    placeholder="Ex.: +55 11 99999-9999"
                    required
                  />
                </div>
                <button type="submit" className="btn btn-block">Registrar número</button>
              </form>
            </div>

            <div className="card settings-card" style={{ marginTop: 20 }}>
              <div className="card-head">
                <div className="card-icon"><Palette size={20} /></div>
                <div>
                  <h3>Aparência</h3>
                  <p className="card-sub">
                    Tema e cor da empresa. Visível para todos os membros.
                  </p>
                </div>
              </div>

              <div className="theme-options">
                {THEME_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`theme-option ${theme === opt.value ? 'active' : ''}`}
                    onClick={() => setTheme(opt.value)}
                  >
                    <span className="theme-icon">{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="field">
                <label>Cor da marca</label>
                <div className="color-swatches">
                  {BRAND_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`swatch ${brandColor.toLowerCase() === color ? 'active' : ''}`}
                      style={{ background: color, color }}
                      onClick={() => setBrandColor(color)}
                      aria-label={`Cor ${color}`}
                    />
                  ))}
                </div>
                <div className="color-custom">
                  <input
                    type="color"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                  />
                  <span className="hex">{brandColor}</span>
                </div>
              </div>

              {canManage ? (
                <form onSubmit={handleSaveAppearance}>
                  <button type="submit" className="btn btn-block">Salvar aparência</button>
                </form>
              ) : (
                <p className="hint">Apenas proprietários e administradores podem alterar.</p>
              )}
            </div>
          </div>

          <div className="card settings-card">
            <div className="card-head">
              <div className="card-icon"><KeyRound size={20} /></div>
              <div>
                <h3>Credenciais do número</h3>
                <p className="card-sub">
                  Guardadas de forma segura (criptografadas) e visíveis apenas para esta organização.
                </p>
              </div>
            </div>

            {channels.length === 0 ? (
              <p className="muted">Nenhum número registrado ainda. Adicione um número ao lado.</p>
            ) : (
              <>
                <div className="field">
                  <label>Número</label>
                  <select
                    value={selectedChannelId}
                    onChange={(e) => setSelectedChannelId(e.target.value)}
                  >
                    {channels.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.displayPhoneNumber}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedChannel && (
                  <div style={{ marginBottom: 16 }}>
                    <span className={`pill ${selectedChannel.configured ? 'pill-success' : 'pill-warning'}`}>
                      {selectedChannel.configured ? 'Configurado' : 'Pendente'}
                    </span>
                  </div>
                )}

                {selectedChannel && (
                  <form onSubmit={handleSaveCredentials}>
                    <div className="field">
                      <label>Access Token</label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={credForm.accessToken}
                        onChange={(e) => setCredForm((f) => ({ ...f, accessToken: e.target.value }))}
                        placeholder={selectedChannel.configured ? '••••••••' : ''}
                      />
                      <p className="hint">Deixe em branco para manter o atual.</p>
                    </div>
                    <div className="field">
                      <label>App Secret</label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={credForm.appSecret}
                        onChange={(e) => setCredForm((f) => ({ ...f, appSecret: e.target.value }))}
                        placeholder={selectedChannel.configured ? '••••••••' : ''}
                      />
                      <p className="hint">Deixe em branco para manter o atual.</p>
                    </div>
                    <div className="field">
                      <label>Webhook Verify Token</label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={credForm.webhookVerifyToken}
                        onChange={(e) => setCredForm((f) => ({ ...f, webhookVerifyToken: e.target.value }))}
                        placeholder={selectedChannel.configured ? '••••••••' : ''}
                      />
                    </div>
                    <div className="field">
                      <label>API Base URL (opcional, para desenvolvimento)</label>
                      <input
                        value={credForm.apiBaseUrl}
                        onChange={(e) => setCredForm((f) => ({ ...f, apiBaseUrl: e.target.value }))}
                        placeholder="http://localhost:4000/graph"
                      />
                    </div>
                    <button type="submit" className="btn btn-block">Salvar credenciais</button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
