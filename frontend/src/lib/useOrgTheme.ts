'use client';

import { useEffect } from 'react';
import type { OrganizationInfo } from './session';
import {
  applyOrgTheme,
  saveThemeCache,
  DEFAULT_THEME,
  DEFAULT_BRAND_COLOR
} from './theme';

/**
 * Aplica o tema (claro/escuro) e a cor da empresa selecionada.
 * Persiste em cache para evitar flash de tema ao recarregar.
 */
export function useOrgTheme(org: OrganizationInfo | null): void {
  useEffect(() => {
    if (!org) return;
    const theme = org.theme ?? DEFAULT_THEME;
    const brandColor = org.brandColor ?? DEFAULT_BRAND_COLOR;
    applyOrgTheme(theme, brandColor);
    saveThemeCache({ theme, brandColor });
  }, [org]);
}
