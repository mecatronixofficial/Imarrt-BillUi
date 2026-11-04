import type { Metadata } from 'next';
import AppFrame from '@/components/AppFrame';
import './globals.css';
import './reference.css';
import './brand-theme.css';

export const metadata: Metadata = {
  title: 'iMarrt Billing — Billing & Invoicing',
  description: 'Professional billing and invoicing software',
  icons: { icon: 'data:,' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  );
}
