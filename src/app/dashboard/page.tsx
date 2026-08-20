'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { loadSession } from '../lib/session';
import type { OrganizationInfo } from '../lib/session';
import { useOrgTheme } from '../lib/useOrgTheme';
import Topbar from './components/Topbar';

type Member = {
  id: string;
  user: { id: string; name: string; email: string };
  role: string;
  active: boolean;
  createdAt: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const [session, _setSession] = useState(loadSession);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationInfo | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'AGENT' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useOrgTheme(selectedOrg);

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
    if (!session || !selectedOrg) return;
    setError('');
    fetch(`/api/organizations/${selectedOrg.id}/members`, {
      headers: { Authorization: `Bearer ${session.token}` }
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.members) setMembers(data.members);
        else setError(data.error ?? 'Erro ao carregar membros.');
      })
      .catch(() => setError('Erro de conexão.'));
  }, [session, selectedOrg]);

  function selectOrg(orgId: string) {
    if (!session) return;
    const org = session.organizations.find((o) => o.id === orgId);
    if (org) setSelectedOrg(org);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !selectedOrg) return;
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/organizations/${selectedOrg.id}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify(inviteForm)
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Erro ao convidar.');
        return;
      }
      setNotice(`Membro ${data.member.user.name} adicionado.`);
      setInviteForm({ name: '', email: '', role: 'AGENT' });
      const updated = await fetch(`/api/organizations/${selectedOrg.id}/members`, {
        headers: { Authorization: `Bearer ${session.token}` }
      }).then((r) => r.json());
      if (updated.members) setMembers(updated.members);
    } catch {
      setError('Erro de conexão.');
    }
  }

  if (!session || !selectedOrg) {
    return (
      <div className="dash">
        <div className="card">Carregando...</div>
      </div>
    );
  }

  return (
    <div>
      <Topbar session={session} selectedOrg={selectedOrg} onSelectOrg={selectOrg} />

      <div className="dash">
        <div className="page-head">
          <h2>Membros</h2>
          <p>Gerencie a equipe de {selectedOrg.name} e convide novos atendentes.</p>
        </div>

        {notice && <div className="alert alert-success">{notice}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <div className="card settings-card">
          <div className="card-head">
            <div className="card-icon">+</div>
            <div>
              <h3>Convidar atendente</h3>
              <p className="card-sub">
                O membro recebe acesso a esta organização com o papel escolhido.
              </p>
            </div>
          </div>
          <form onSubmit={handleInvite} className="invite-form">
            <div className="field">
              <label>Nome</label>
              <input
                value={inviteForm.name}
                onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label>E-mail</label>
              <input
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div className="field invite-role">
              <label>Papel</label>
              <select
                value={inviteForm.role}
                onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value }))}
              >
                <option value="AGENT">Atendente</option>
                <option value="ADMIN">Administrador</option>
                <option value="VIEWER">Leitor</option>
              </select>
            </div>
            <div className="field invite-submit">
              <button type="submit" className="btn">Convidar</button>
            </div>
          </form>
        </div>

        <div className="card settings-card" style={{ marginTop: 20 }}>
          <div className="card-head">
            <div className="card-icon">{members.length}</div>
            <div>
              <h3>Membros</h3>
              <p className="card-sub">Pessoas com acesso a esta organização.</p>
            </div>
          </div>
          <table className="members-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Papel</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>{m.user.name}</td>
                  <td>{m.user.email}</td>
                  <td>
                    <span className="badge">{m.role}</span>
                  </td>
                  <td>
                    <span className={m.active ? 'badge' : 'badge inactive'}>
                      {m.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
