import type { Metadata } from 'next';
import AppFrame from '@/components/AppFrame';
import './globals.css';

export const metadata: Metadata = {
  title: 'iMart Billing — Billing & Invoicing',
  description: 'Professional billing and invoicing software',
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
