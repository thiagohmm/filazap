import type { Metadata } from 'next';
import './globals.css';
import { themeInitScript } from './lib/theme';

export const metadata: Metadata = {
  title: 'FilaZap — Central de Atendimento',
  description: 'Fila justa para atendimento via WhatsApp',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover'
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
