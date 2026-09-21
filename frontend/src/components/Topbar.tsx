import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3, Building2, ChevronDown, Headphones, LogOut, Menu,
  MessageCircleMore, Search, Settings, Users, X
} from 'lucide-react';
import { clearSession } from '../lib/session';
import type { OrganizationInfo, Session } from '../lib/session';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Visão geral', icon: BarChart3, exact: true },
  { href: '/dashboard/atendimento', label: 'Atendimento', icon: Headphones, exact: false },
  { href: '/dashboard/equipe', label: 'Equipe', icon: Users, exact: false },
  { href: '/dashboard/configuracoes', label: 'Configurações', icon: Settings, exact: false }
] as const;

type TopbarProps = {
  session: Session;
  selectedOrg: OrganizationInfo;
  onSelectOrg: (orgId: string) => void;
  children?: React.ReactNode;
};

export default function Topbar({ session, selectedOrg, onSelectOrg, children }: TopbarProps) {
  const pathname = useLocation().pathname;
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  function logout() {
    clearSession();
    void fetch('/api/auth/logout', { method: 'POST' });
    navigate('/login', { replace: true });
  }

  const initials = session.user.name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const current = NAV_ITEMS.find((item) => item.exact ? pathname === item.href : pathname.startsWith(item.href));

  return (
    <>
      <button type="button" className="mobile-menu-button" onClick={() => setMenuOpen(true)} aria-label="Abrir navegação">
        <Menu size={20} />
      </button>
      {menuOpen && <button className="sidebar-backdrop" onClick={() => setMenuOpen(false)} aria-label="Fechar navegação" />}

      <aside className={`app-sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <span className="brand-mark"><MessageCircleMore size={22} /></span>
          <span><strong>FilaZap</strong><small>Atendimento inteligente</small></span>
          <button type="button" className="sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"><X size={19} /></button>
        </div>

        <div className="workspace-label">Workspace</div>
        <div className="workspace-card">
          <span className="workspace-icon"><Building2 size={18} /></span>
          <span className="workspace-copy"><strong>{selectedOrg.name}</strong><small>{selectedOrg.role}</small></span>
          <ChevronDown size={15} />
          <select aria-label="Selecionar organização" value={selectedOrg.id} onChange={(event) => onSelectOrg(event.target.value)}>
            {session.organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
          </select>
        </div>

        <nav className="side-nav" aria-label="Navegação principal">
          <span className="side-nav-label">Menu</span>
          {NAV_ITEMS.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} to={item.href} className={active ? 'active' : ''} onClick={() => setMenuOpen(false)}>
                <Icon size={18} strokeWidth={1.9} /><span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-user">
          <span className="user-avatar">{initials}</span>
          <span className="user-copy"><strong>{session.user.name}</strong><small>{session.user.email}</small></span>
          <button type="button" onClick={logout} title="Sair" aria-label="Sair"><LogOut size={18} /></button>
        </div>
      </aside>

      <header className="app-topbar">
        <div className="topbar-context"><span>{current?.label ?? 'FilaZap'}</span><small>{selectedOrg.name}</small></div>
        <div className="topbar-tools">
          {children}
          {!children && <div className="topbar-search-hint"><Search size={16} /><span>Centralize seu atendimento</span></div>}
          <span className="status-live"><i /> Operação online</span>
        </div>
      </header>
    </>
  );
}
