'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearSession } from '../../lib/session';
import type { OrganizationInfo, Session } from '../../lib/session';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Membros', exact: true },
  { href: '/dashboard/atendimento', label: 'Central', exact: false },
  { href: '/dashboard/configuracoes', label: 'Configurações', exact: false }
] as const;

type TopbarProps = {
  session: Session;
  selectedOrg: OrganizationInfo;
  onSelectOrg: (orgId: string) => void;
  children?: React.ReactNode;
};

export default function Topbar({ session, selectedOrg, onSelectOrg, children }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    clearSession();
    router.replace('/login');
  }

  return (
    <div className="topbar">
      <div className="topbar-left">
        <div className="brand">FilaZap</div>
        <nav className="topnav">
          {NAV_ITEMS.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={active ? 'active' : ''}>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="topbar-right">
        {children}
        <select value={selectedOrg.id} onChange={(e) => onSelectOrg(e.target.value)}>
          {session.organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
        <span className="user">
          {session.user.name} ({selectedOrg.role})
        </span>
        <button className="btn btn-danger" onClick={logout}>
          Sair
        </button>
      </div>
    </div>
  );
}
