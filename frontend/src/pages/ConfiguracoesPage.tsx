import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { QrCode, KeyRound, MessageCircleMore, Palette, Settings2, ShieldCheck } from 'lucide-react';
import { loadSession, saveSession } from '../lib/session';
import type { OrganizationInfo } from '../lib/session';
import { useOrgTheme } from '../lib/useOrgTheme';
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

type WahaState = {
  sessionName: string;
  apiKey: string;
  qrDataUrl: string;
  status: string;
  state: string;
  me: unknown;
  connected: boolean;
  loading: boolean;
  error: string;
};

const EMPTY_WAHA: WahaState = {
  sessionName: '',
  apiKey: '',
  qrDataUrl: '',
  status: '',
  state: '',
  me: null,
  connected: false,
  loading: true,
  error: ''
};

/** Tenta extrair o número pairado do objeto "me" do WAHA (estrutura varia entre versões). */
function wahaMePhone(me: unknown): string | null {
  if (!me || typeof me !== 'object') return null;
  const m = me as Record<string, unknown>;
  const cand = [m.phone, m.number, m.jid, m.id, m.pushName, m.name].find((v) => typeof v === 'string') as
    | string
    | undefined;
  if (!cand) return null;
  // jid/id vêm como "5511999999999@c.us" — extrai o prefixo numérico (E.164).
  const num = cand.split('@')[0].replace(/\D/g, '');
  return num ? num : null;
}

export default function ConfiguracoesPage() {
  const navigate = useNavigate();
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

  const [waha, setWaha] = useState<WahaState>(EMPTY_WAHA);
  const pollRef = useRef<number | null>(null);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useOrgTheme(selectedOrg);

  const canManage = selectedOrg?.role === 'OWNER' || selectedOrg?.role === 'ADMIN';

  useEffect(() => {
    if (!session) {
      navigate('/login', { replace: true });
      return;
    }
    if (!selectedOrg && session.organizations.length > 0) {
      setSelectedOrg(session.organizations[0]);
    }
  }, [session, selectedOrg, navigate]);

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

  // --- Conectar WhatsApp via QR (WAHA) ---
  async function refreshQr(sessionName: string) {
    if (!session) return;
    try {
      const res = await fetch(
        `/api/whatsapp/waha/qr?session=${encodeURIComponent(sessionName)}`,
        { headers: { Authorization: `Bearer ${session.token}` } }
      );
      if (!res.ok) throw new Error('Erro ao obter o QR do WAHA.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setWaha((p) => {
        if (p.qrDataUrl) URL.revokeObjectURL(p.qrDataUrl);
        return { ...p, qrDataUrl: url, error: '' };
      });
    } catch (e) {
      setWaha((p) => ({ ...p, error: (e as Error).message }));
    }
  }

  async function refreshStatus(sessionName: string) {
    if (!session) return;
    try {
      const res = await fetch(
        `/api/whatsapp/waha/status?session=${encodeURIComponent(sessionName)}`,
        { headers: { Authorization: `Bearer ${session.token}` } }
      );
      const data = await res.json();
      setWaha((p) => ({
        ...p,
        status: data.status ?? '',
        state: data.state ?? '',
        me: data.me ?? null,
        connected: !!data.connected,
        loading: false,
        error: data.error ?? ''
      }));
      // Conectou: para o polling até uma nova ação.
      if (data.connected && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    } catch {
      // tolera fal transitório entre polls
    }
  }

  useEffect(() => {
    let active = true;
    let sessionName = '';

    async function init() {
      if (!session || !selectedOrg) return;
      active = true;
      setWaha((p) => ({ ...EMPTY_WAHA, loading: true }));
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      try {
        const c = await fetch('/api/whatsapp/waha/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
          body: JSON.stringify({ orgId: selectedOrg.id })
        });
        const cData = await c.json();
        if (!c.ok) throw new Error(cData.error ?? 'Erro ao iniciar o WAHA.');
        sessionName = cData.sessionName;
        setWaha((p) => ({ ...p, sessionName: cData.sessionName, apiKey: cData.apiKey ?? '' }));
        await refreshQr(sessionName);
        await refreshStatus(sessionName);
        pollRef.current = window.setInterval(() => void refreshStatus(sessionName), 3000);
      } catch (e) {
        if (active) setWaha((p) => ({ ...p, loading: false, error: (e as Error).message }));
      }
    }

    init();
    return () => {
      active = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [session, selectedOrg]);

  async function handleRegisterWahaChannel() {
    if (!canManage || !waha.sessionName) return;
    setError('');
    setNotice('');
    const phone = wahaMePhone(waha.me);
    try {
      const res = await fetch(`/api/organizations/${selectedOrg!.id}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.token}` },
        body: JSON.stringify({
          phoneNumberId: waha.sessionName,
          businessAccountId: 'waha',
          displayPhoneNumber: phone || waha.sessionName
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Erro ao registrar o canal.');
        return;
      }
      // Armazena a chave de API do WAHA como accessToken do canal (criptografada em repouso).
      await fetch(`/api/organizations/${selectedOrg!.id}/channels/${data.channel.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.token}` },
        body: JSON.stringify({ accessToken: waha.apiKey, apiBaseUrl: '' })
      });
      setNotice(`Canal ${phone || waha.sessionName} registrado e conectado ao WAHA.`);
      const updated = await fetch(`/api/organizations/${selectedOrg!.id}/channels`, {
        headers: { Authorization: `Bearer ${session!.token}` }
      }).then((r) => r.json());
      if (updated.channels) setChannels(updated.channels);
    } catch {
      setError('Erro de conexão.');
    }
  }

  async function handleWahaLogout() {
    if (!waha.sessionName) return;
    setError('');
    setNotice('');
    try {
      await fetch(`/api/whatsapp/waha/logout?session=${encodeURIComponent(waha.sessionName)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session!.token}` }
      });
      setWaha((p) => ({ ...EMPTY_WAHA, loading: true }));
      setNotice('WhatsApp desconectado.');
    } catch {
      setError('Erro de conexão.');
    }
  }

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
    if (!session || !selectedOrg || !canManage) return;
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
    if (!session || !selectedOrg || !selectedChannelId || !canManage) return;
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
    if (!session || !selectedOrg || !canManage) return;
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
          <p>{canManage ? 'Gerencie' : 'Consulte'} os números de WhatsApp e a aparência de {selectedOrg.name}.</p>
          </div>
          <div className="head-stat"><Settings2 size={20} /><span><strong>{channels.length}</strong> canal(is)</span></div>
        </div>

        {notice && <div className="alert alert-success">{notice}</div>}
        {error && <div className="alert alert-error">{error}</div>}
        {!canManage && <div className="settings-readonly"><ShieldCheck size={17} /><span><strong>Modo somente leitura.</strong> Apenas proprietários e administradores podem alterar configurações.</span></div>}

        {canManage && (
          <div className="card waha-card">
            <div className="card-head">
              <div className="card-icon"><QrCode size={20} /></div>
              <div>
                <h3>Conectar via QR</h3>
                <p className="card-sub">
                  Paire qualquer celular (personal ou Business) escaneando o QR no{' '}
                  <a href="https://web.whatsapp.com" target="_blank" rel="noreferrer">WhatsApp → Conectados</a>.
                </p>
              </div>
            </div>

            {waha.error && <div className="alert alert-error" style={{ marginTop: 8 }}>{waha.error}</div>}

            {!waha.connected && waha.loading && (
              <div className="waha-loading"><span className="spinner" />Gerando o QR code…</div>
            )}

            {!waha.connected && waha.qrDataUrl && (
              <div className="waha-scan">
                <p className="hint">Abra o WhatsApp no celular → <strong>Conectados</strong> e escane este QR.</p>
                <img src={waha.qrDataUrl} alt="QR code para conectar o WhatsApp" className="waha-qr" />
                <p className="hint">Status: {waha.status || waha.state || 'aguardando o scan…'}</p>
              </div>
            )}

            {waha.connected && (
              <div className="waha-connected">
                <span className="pill pill-success">Conectado</span>
                <p className="hint">Número pairado: <strong>{wahaMePhone(waha.me) || 'não identificado'}</strong></p>
                <div className="waha-actions">
                  <button type="button" className="btn btn-block" onClick={handleRegisterWahaChannel}>
                    Registrar como canal
                  </button>
                  <button type="button" className="btn btn-outline" onClick={handleWahaLogout}>
                    Desconectar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="settings-grid">
          <div>
            {canManage && <div className="card settings-card">
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
            </div>}

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
                    onClick={() => canManage && setTheme(opt.value)}
                    disabled={!canManage}
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
                      onClick={() => canManage && setBrandColor(color)}
                      disabled={!canManage}
                      aria-label={`Cor ${color}`}
                    />
                  ))}
                </div>
                <div className="color-custom">
                  <input
                    type="color"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    disabled={!canManage}
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

                {selectedChannel && canManage && (
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
                {selectedChannel && !canManage && (
                  <p className="hint">As credenciais ficam protegidas e não podem ser visualizadas ou alteradas por atendentes.</p>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
