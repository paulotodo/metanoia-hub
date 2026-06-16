import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@metanoia/ui/styles/globals.css';
import { SkipNav } from '@/components/a11y/skip-nav';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Metanoia Hub',
  description: 'Plataforma de discipulado e cuidado pastoral',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <body className="bg-surface-base text-text-primary font-sans antialiased">
        {/* Skip navigation — first focusable element (WCAG 2.1 SC 2.4.1, US1, FR-001) */}
        <SkipNav />
        {children}
      </body>
    </html>
  );
}
