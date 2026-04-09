import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Metanoia Hub',
  description: 'Plataforma de discipulado e cuidado pastoral',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
