import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react';
import { loadSession } from '../lib/session';
import type { OrganizationInfo } from '../lib/session';
import { useOrgTheme } from '../lib/useOrgTheme';
import Topbar from '../components/Topbar';

type Member = {
  id: string;
  user: { id: string; name: string; email: string };
  role: string;
  active: boolean;
  createdAt: string;
};

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Proprietário', ADMIN: 'Administrador', AGENT: 'Atendente', VIEWER: 'Leitor'
};

export default function EquipePage() {
  const navigate = useNavigate();
  const [session] = useState(loadSession);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationInfo | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'AGENT' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  useOrgTheme(selectedOrg);

  useEffect(() => {
    if (!session) { navigate('/login', { replace: true }); return; }
    if (!selectedOrg && session.organizations.length > 0) setSelectedOrg(session.organizations[0]);
  }, [session, selectedOrg, navigate]);

  useEffect(() => {
    if (!session || !selectedOrg) return;
    setError('');
    fetch(`/api/organizations/${selectedOrg.id}/members`, { headers: { Authorization: `Bearer ${session.token}` } })
      .then((response) => response.json())
      .then((data) => data.members ? setMembers(data.members) : setError(data.error ?? 'Erro ao carregar membros.'))
      .catch(() => setError('Erro de conexão.'));
  }, [session, selectedOrg]);

  function selectOrg(orgId: string) {
    const org = session?.organizations.find((item) => item.id === orgId);
    if (org) setSelectedOrg(org);
  }

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    if (!session || !selectedOrg || !['OWNER', 'ADMIN'].includes(selectedOrg.role)) return;
    setError(''); setNotice(''); setLoading(true);
    try {
      const response = await fetch(`/api/organizations/${selectedOrg.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify(inviteForm)
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? 'Erro ao convidar.'); return; }
      setNotice(`${data.member.user.name} agora faz parte da equipe.`);
      setInviteForm({ name: '', email: '', role: 'AGENT' });
      const updated = await fetch(`/api/organizations/${selectedOrg.id}/members`, { headers: { Authorization: `Bearer ${session.token}` } }).then((r) => r.json());
      if (updated.members) setMembers(updated.members);
    } catch { setError('Erro de conexão.'); } finally { setLoading(false); }
  }

  async function handleRemove(member: Member) {
    if (!session || !selectedOrg) return;
    const confirmed = window.confirm(
      `Remover ${member.user.name} da equipe? O atendente perderá o acesso a ${selectedOrg.name}.`
    );
    if (!confirmed) return;

    setError('');
    setNotice('');
    setRemovingMemberId(member.id);
    try {
      const response = await fetch(
        `/api/organizations/${selectedOrg.id}/members/${member.id}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${session.token}` }
        }
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? 'Erro ao remover atendente.');
        return;
      }
      setMembers((current) => current.map((item) =>
        item.id === member.id ? { ...item, active: false } : item
      ));
      setNotice(`${member.user.name} foi removido da equipe.`);
    } catch {
      setError('Erro de conexão.');
    } finally {
      setRemovingMemberId(null);
    }
  }

  if (!session || !selectedOrg) return <div className="loading-screen"><span className="spinner" />Carregando workspace...</div>;
  const canManageMembers = selectedOrg.role === 'OWNER' || selectedOrg.role === 'ADMIN';

  return (
    <div>
      <Topbar session={session} selectedOrg={selectedOrg} onSelectOrg={selectOrg} />
      <main className="dash page-content">
        <div className="page-head page-head-row">
          <div><span className="eyebrow">Pessoas e acessos</span><h1>Equipe</h1><p>{canManageMembers ? 'Gerencie' : 'Consulte'} quem atende e acompanha a operação de {selectedOrg.name}.</p></div>
          <div className="head-stat"><Users size={20} /><span><strong>{members.filter((m) => m.active).length}</strong> membros ativos</span></div>
        </div>

        {notice && <div className="alert alert-success">{notice}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        {canManageMembers && (
          <section className="card team-invite-card">
            <div className="section-heading"><span className="section-icon"><UserPlus size={20} /></span><div><h2>Adicionar membro</h2><p>Convide um colaborador e defina seu nível de acesso.</p></div></div>
            <form onSubmit={handleInvite} className="invite-form">
              <div className="field"><label>Nome completo</label><input value={inviteForm.name} onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex.: Ana Souza" required /></div>
              <div className="field"><label>E-mail corporativo</label><input type="email" value={inviteForm.email} onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))} placeholder="ana@empresa.com" required /></div>
              <div className="field invite-role"><label>Perfil</label><select value={inviteForm.role} onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value }))}><option value="AGENT">Atendente</option><option value="ADMIN">Administrador</option><option value="VIEWER">Leitor</option></select></div>
              <div className="field invite-submit"><button type="submit" className="btn" disabled={loading}>{loading ? 'Adicionando...' : 'Adicionar membro'}</button></div>
            </form>
          </section>
        )}

        <section className="card team-table-card">
          <div className="section-heading"><span className="section-icon"><ShieldCheck size={20} /></span><div><h2>Membros da organização</h2><p>Usuários com acesso a este workspace.</p></div></div>
          <div className="table-scroll"><table className="members-table"><thead><tr><th>Colaborador</th><th>E-mail</th><th>Perfil</th><th>Status</th>{canManageMembers && <th className="member-actions-heading">Ações</th>}</tr></thead><tbody>
            {members.map((member) => <tr key={member.id}><td><div className="member-name"><span className="mini-avatar">{member.user.name.slice(0, 2).toUpperCase()}</span><strong>{member.user.name}</strong></div></td><td>{member.user.email}</td><td><span className="role-badge">{ROLE_LABEL[member.role] ?? member.role}</span></td><td><span className={`state-badge ${member.active ? 'active' : 'inactive'}`}><i />{member.active ? 'Ativo' : 'Inativo'}</span></td>{canManageMembers && <td className="member-actions">{member.role === 'AGENT' && member.active ? <button type="button" className="btn btn-danger btn-sm member-remove-button" onClick={() => handleRemove(member)} disabled={removingMemberId === member.id}>{removingMemberId === member.id ? 'Removendo...' : <><Trash2 size={13} />Remover</>}</button> : <span className="member-no-action">—</span>}</td>}</tr>)}
          </tbody></table></div>
        </section>
      </main>
    </div>
  );
}
